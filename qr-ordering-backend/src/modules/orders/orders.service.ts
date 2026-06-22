import { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/response';
import { buildKitchenPayload } from '../../lib/printPayload';
import { config } from '../../config/env';
import { ordersPlacedTotal } from '../../lib/metrics';
import { effectiveItemPrice } from '../../lib/pricing';
import { isItemAvailableNow } from '../../lib/availability';
import type { CreateAdminOrderInput } from '../../validators/order';

const MAX_ATTEMPTS = 5;

/**
 * Returns the table's currently OPEN session, creating one if none exists.
 *
 * The partial unique index "TableSession_open_per_table_key" guarantees at most
 * one OPEN session per table. If two concurrent submissions for the same free
 * table both try to create a session, the second INSERT throws P2002; we catch
 * it and re-query the now-existing open session. This runs on the base client
 * (its own short writes) BEFORE the order transaction, so a P2002 here can never
 * poison that transaction.
 */
async function ensureOpenSession(storeId: string, tableId: string) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const existing = await prisma.tableSession.findFirst({
      where: { tableId, status: 'OPEN' },
    });
    if (existing) return existing;

    try {
      const agg = await prisma.tableSession.aggregate({
        where: { storeId },
        _max: { sessionNumber: true },
      });
      const sessionNumber = (agg._max.sessionNumber ?? 0) + 1;
      return await prisma.tableSession.create({
        data: { storeId, tableId, sessionNumber, status: 'OPEN' },
      });
    } catch (err) {
      const isRace = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (isRace && attempt < MAX_ATTEMPTS) continue;
      throw err;
    }
  }
  throw ApiError.conflict('Could not open a table session, please retry');
}

/**
 * Creates an order from a customer submission.
 *  1. Validate table exists and is active
 *  2. Validate menu items exist and are available
 *  3. Validate selected options + recalculate prices server-side (incl. option price deltas)
 *  4-6. Create order + items (with option snapshot) + PENDING print job
 *  7. Return order id + number
 */
export async function createOrder(input: CreateAdminOrderInput, ctx: { admin?: boolean } = {}) {
  // 1. Validate table
  const table = await prisma.table.findUnique({ where: { code: input.tableCode } });
  if (!table) throw ApiError.notFound(`Table "${input.tableCode}" was not found`);
  if (!table.isActive) throw ApiError.badRequest(`Table "${input.tableCode}" is not active`);

  // Price overrides + takeaway are staff-only — honoured solely when an admin
  // placed the order. The takeaway packaging charge comes from store settings.
  const takeawayUnitCharge = ctx.admin
    ? Number(
        (
          await prisma.store.findUnique({
            where: { id: table.storeId },
            select: { takeawayCharge: true },
          })
        )?.takeawayCharge ?? 0,
      )
    : 0;

  // 2. Load items + their option groups/choices (scoped to the store). Custom
  // (open) lines have no menuItemId and are skipped here.
  const itemIds = [
    ...new Set(input.items.map((i) => i.menuItemId).filter((id): id is string => !!id)),
  ];
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: itemIds }, storeId: table.storeId },
    include: {
      optionGroups: {
        orderBy: { sortOrder: 'asc' },
        include: { choices: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  });
  const byId = new Map(menuItems.map((m) => [m.id, m]));

  // 3. Validate each line + options; recompute price server-side
  const lines = input.items.map((line) => {
    // Custom (open) item — admin only: an ad-hoc line with a name + price, no
    // menu lookup or options.
    if (ctx.admin && !line.menuItemId && line.customName) {
      const unitPrice = new Prisma.Decimal(line.customPrice ?? 0).toDecimalPlaces(2);
      const isTakeaway = !!line.isTakeaway;
      const takeawayCharge =
        isTakeaway && line.applyTakeawayCharge
          ? new Prisma.Decimal(takeawayUnitCharge)
          : new Prisma.Decimal(0);
      const lineGross = unitPrice.add(takeawayCharge).mul(line.quantity);

      let discountType: string | null = null;
      let discountValue = new Prisma.Decimal(0);
      let discountAmount = new Prisma.Decimal(0);
      if (line.discountType && line.discountValue && line.discountValue > 0) {
        discountType = line.discountType;
        discountValue = new Prisma.Decimal(line.discountValue);
        discountAmount =
          line.discountType === 'PERCENT'
            ? lineGross.mul(Math.min(100, line.discountValue)).div(100)
            : discountValue;
        if (discountAmount.greaterThan(lineGross)) discountAmount = lineGross;
        discountAmount = discountAmount.toDecimalPlaces(2);
      }

      return {
        menuItemId: null as string | null,
        name: line.customName.trim(),
        quantity: line.quantity,
        unitPrice,
        takeawayCharge,
        isTakeaway,
        priceOverridden: false,
        discountType,
        discountValue,
        discountAmount,
        totalPrice: lineGross.sub(discountAmount).toDecimalPlaces(2),
        note: line.note?.trim() ? line.note.trim() : null,
        selectedOptions: [] as { group: string; choice: string; priceDelta: number }[],
        optionStrings: [] as string[],
      };
    }

    const mi = line.menuItemId ? byId.get(line.menuItemId) : undefined;
    if (!mi) throw ApiError.badRequest(`Menu item "${line.menuItemId ?? '?'}" is not on this menu`);
    if (!mi.isAvailable) throw ApiError.badRequest(`"${mi.name}" is sold out`);
    // Off-schedule items are blocked for diners, but staff can still order them.
    if (!ctx.admin && !isItemAvailableNow(mi)) {
      throw ApiError.badRequest(`"${mi.name}" isn't available right now`);
    }

    const submitted = line.optionChoiceIds ?? [];
    const submittedSet = new Set(submitted);

    // Which group does each submitted choice belong to? (reject foreign choices)
    const groupIdByChoice = new Map<string, string>();
    for (const g of mi.optionGroups) {
      for (const c of g.choices) groupIdByChoice.set(c.id, g.id);
    }
    for (const cid of submitted) {
      if (!groupIdByChoice.has(cid)) {
        throw ApiError.badRequest(`Invalid option selected for "${mi.name}"`);
      }
    }

    // Per-group selection counts → enforce required / min / max
    const countByGroup = new Map<string, number>();
    for (const cid of submitted) {
      const gid = groupIdByChoice.get(cid)!;
      countByGroup.set(gid, (countByGroup.get(gid) ?? 0) + 1);
    }
    for (const g of mi.optionGroups) {
      const count = countByGroup.get(g.id) ?? 0;
      if (g.required && count < g.minSelect) {
        throw ApiError.badRequest(`Please choose "${g.name}" for "${mi.name}"`);
      }
      if (count > g.maxSelect) {
        throw ApiError.badRequest(
          `Too many choices for "${g.name}" on "${mi.name}" (max ${g.maxSelect})`,
        );
      }
    }

    // Build option snapshot + ticket strings + price delta (in group/choice order)
    const selectedOptions: { group: string; choice: string; priceDelta: number }[] = [];
    const optionStrings: string[] = [];
    let delta = new Prisma.Decimal(0);
    for (const g of mi.optionGroups) {
      for (const c of g.choices) {
        if (submittedSet.has(c.id)) {
          const d = new Prisma.Decimal(c.priceDelta);
          selectedOptions.push({ group: g.name, choice: c.name, priceDelta: Number(d) });
          optionStrings.push(`${g.name}: ${c.name}`);
          delta = delta.add(d);
        }
      }
    }

    // Ad-hoc custom add-ons / special requests (admin only): each is a named
    // extra with its own price that adds to the unit price and prints on the
    // ticket. Stored alongside menu options in the line's option snapshot, so it
    // shows on the tab/bill with no schema change. Like override/discount, this
    // trusts the admin-authenticated request (no PIN — an add-on only adds cost).
    if (ctx.admin && line.addons) {
      for (const a of line.addons) {
        const name = a.name.trim();
        if (!name) continue;
        const d = new Prisma.Decimal(a.price).toDecimalPlaces(2);
        selectedOptions.push({ group: 'Add-on', choice: name, priceDelta: Number(d) });
        optionStrings.push(
          d.greaterThan(0) ? `Add-on: ${name} (+${d.toFixed(2)})` : `Add-on: ${name}`,
        );
        delta = delta.add(d);
      }
    }

    // Manual price override (admin only) replaces the computed unit price; the
    // option snapshot is still kept for the kitchen ticket. The item's standing
    // menu discount (if any) reduces the base price; options add at full value.
    const saleBase = effectiveItemPrice(mi.price, mi.discountType, mi.discountValue);
    const basePrice = saleBase.add(delta);
    const overridden = !!(ctx.admin && line.priceOverride != null);
    // Round an override to cents so every persisted figure stays at 2dp and the
    // line reconciles exactly (unitPrice*qty - discount == totalPrice).
    const unitPrice = overridden
      ? new Prisma.Decimal(line.priceOverride!).toDecimalPlaces(2)
      : basePrice;

    const isTakeaway = !!(ctx.admin && line.isTakeaway);
    const takeawayCharge =
      isTakeaway && line.applyTakeawayCharge
        ? new Prisma.Decimal(takeawayUnitCharge)
        : new Prisma.Decimal(0);

    // Each unit is charged item price + packaging charge.
    const lineUnit = unitPrice.add(takeawayCharge);
    const lineGross = lineUnit.mul(line.quantity);

    // Manual line discount (admin only): PERCENT or FIXED off the whole line.
    // Like price override, this is gated CLIENT-SIDE by the override PIN; the
    // server intentionally trusts admin-authenticated requests and does NOT
    // re-verify the PIN here (unlike void, which enforces it server-side).
    let discountType: string | null = null;
    let discountValue = new Prisma.Decimal(0);
    let discountAmount = new Prisma.Decimal(0);
    if (ctx.admin && line.discountType && line.discountValue && line.discountValue > 0) {
      discountType = line.discountType;
      discountValue = new Prisma.Decimal(line.discountValue);
      discountAmount =
        line.discountType === 'PERCENT'
          ? lineGross.mul(Math.min(100, line.discountValue)).div(100)
          : discountValue;
      // Never discount more than the line is worth.
      if (discountAmount.greaterThan(lineGross)) discountAmount = lineGross;
      discountAmount = discountAmount.toDecimalPlaces(2);
    }

    return {
      menuItemId: mi.id,
      name: mi.name,
      quantity: line.quantity,
      unitPrice,
      takeawayCharge,
      isTakeaway,
      priceOverridden: overridden,
      discountType,
      discountValue,
      discountAmount,
      totalPrice: lineGross.sub(discountAmount).toDecimalPlaces(2),
      note: line.note?.trim() ? line.note.trim() : null,
      selectedOptions,
      optionStrings,
    };
  });

  const subtotal = lines.reduce((acc, l) => acc.add(l.totalPrice), new Prisma.Decimal(0));
  const total = subtotal; // no taxes/service charge in MVP
  const totalItems = lines.reduce((s, l) => s + l.quantity, 0);
  const note = input.note?.trim() ? input.note.trim() : null;

  // Attach this round to the table's running tab (one OPEN session per table,
  // created on the first round and reused for subsequent rounds).
  const session = await ensureOpenSession(table.storeId, table.id);

  // 4-6. Persist atomically, retrying on a per-store order-number race.
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const order = await prisma.$transaction(async (tx) => {
        const agg = await tx.order.aggregate({
          where: { storeId: table.storeId },
          _max: { orderNumber: true },
        });
        const orderNumber = (agg._max.orderNumber ?? config.orderNumberBase) + 1;

        // Round index within the running tab (1-based).
        const priorRounds = await tx.order.count({ where: { sessionId: session.id } });
        const roundNumber = priorRounds + 1;

        const created = await tx.order.create({
          data: {
            storeId: table.storeId,
            tableId: table.id,
            sessionId: session.id,
            orderNumber,
            roundNumber,
            status: 'NEW',
            subtotal,
            total,
            note,
            items: {
              create: lines.map((l) => ({
                menuItemId: l.menuItemId,
                name: l.name,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                totalPrice: l.totalPrice,
                note: l.note,
                selectedOptions: l.selectedOptions as unknown as Prisma.InputJsonValue,
                isTakeaway: l.isTakeaway,
                takeawayCharge: l.takeawayCharge,
                priceOverridden: l.priceOverridden,
                discountType: l.discountType,
                discountValue: l.discountValue,
                discountAmount: l.discountAmount,
              })),
            },
          },
        });

        const payload = buildKitchenPayload({
          orderNumber: created.orderNumber,
          roundNumber,
          sessionNumber: session.sessionNumber,
          tableName: table.name,
          createdAt: created.createdAt,
          note: created.note,
          items: lines.map((l) => ({
            name: l.name,
            quantity: l.quantity,
            note: l.note,
            options: l.optionStrings,
            takeaway: l.isTakeaway,
          })),
        });

        await tx.printJob.create({
          data: {
            orderId: created.id,
            status: 'PENDING',
            payload: payload as unknown as Prisma.InputJsonValue,
          },
        });

        return created;
      });

      ordersPlacedTotal.inc();

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        tableName: table.name,
        sessionId: session.id,
        sessionNumber: session.sessionNumber,
        roundNumber: order.roundNumber,
        subtotal: Number(order.subtotal),
        total: Number(order.total),
        totalItems,
        createdAt: order.createdAt,
      };
    } catch (err) {
      const isOrderNumberRace =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (isOrderNumberRace && attempt < MAX_ATTEMPTS) continue;
      throw err;
    }
  }

  throw ApiError.conflict('Could not allocate an order number, please retry');
}
