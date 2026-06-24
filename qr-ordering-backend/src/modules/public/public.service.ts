import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/response';
import { salePriceOf } from '../../lib/pricing';
import { isItemAvailableNow } from '../../lib/availability';
import { buildCombosForMenu } from '../menu/combo.service';
import { currentStoreId } from '../../lib/tenant';
import {
  effectiveAvailable,
  effectivePrice,
  offeredAtOutlet,
  outletStateMap,
} from '../../lib/outletOverrides';

/** Loads an active table by its public code, together with its store. */
export async function getTableByCode(tableCode: string) {
  const table = await prisma.table.findUnique({
    where: { code: tableCode },
    include: { store: true },
  });

  if (!table) {
    throw ApiError.notFound(`Table "${tableCode}" was not found`);
  }
  if (!table.isActive) {
    throw ApiError.badRequest(`Table "${tableCode}" is not active`);
  }

  return {
    table: {
      id: table.id,
      name: table.name,
      code: table.code,
      isActive: table.isActive,
    },
    store: {
      id: table.store.id,
      name: table.store.name,
      slug: table.store.slug,
      logoUrl: table.store.logoUrl,
      themeColor: table.store.themeColor,
      // The shared catalogue this outlet's menu is read from (per-store settings
      // like banner / takeaway stay on the store).
      catalogueId: table.store.catalogueId,
    },
  };
}

/**
 * Builds a store's menu (active categories + items) plus the featured strip.
 * `includePosOnly` is false for the customer menu (POS-only "secret" items are
 * hidden) and true for the staff POS menu.
 */
async function buildStoreMenu(
  storeId: string,
  catalogueId: string | null,
  opts: { includePosOnly: boolean },
) {
  // Customer menu hides POS-only items; the POS menu includes them.
  const posFilter = opts.includePosOnly ? {} : { posOnly: false };
  // The customer menu also hides items outside their availability window; the POS
  // shows everything (staff can order off-schedule). `availableNow` is flagged so
  // the POS can badge an off-schedule item.
  const now = new Date();
  const hideUnscheduled = !opts.includePosOnly;
  const scheduledIn = (it: {
    availableDays: number[];
    availableFrom: string | null;
    availableTo: string | null;
  }) => !hideUnscheduled || isItemAvailableNow(it, now);

  const [settings, categories, featuredItems] = await Promise.all([
    prisma.store.findUnique({
      where: { id: storeId },
      select: {
        featuredTitle: true,
        featuredEnabled: true,
        takeawayCharge: true,
        bannerImageUrls: true,
        bannerTitle: true,
        bannerSubtitle: true,
      },
    }),
    prisma.menuCategory.findMany({
      where: { catalogueId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        items: {
          // isActive: true — hide archived (deactivated) items from customers
          // and the POS. deletedAt: null — a nested include isn't covered by the
          // soft-delete extension's read filter, so exclude soft-deleted here too.
          where: { ...posFilter, isActive: true, deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: {
            optionGroups: {
              orderBy: { sortOrder: 'asc' },
              include: { choices: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
      },
    }),
    // Featured strip: featured + available items only, across all categories.
    prisma.menuItem.findMany({
      where: { catalogueId, isFeatured: true, isAvailable: true, isActive: true, ...posFilter },
      orderBy: [{ featuredOrder: 'asc' }, { name: 'asc' }],
      include: {
        optionGroups: {
          orderBy: { sortOrder: 'asc' },
          include: { choices: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    }),
  ]);

  type ItemPayload = (typeof featuredItems)[number];
  // Per-outlet overrides (price / sold-out / offered-here) for the resolving outlet.
  const states = await outletStateMap(storeId, [
    ...new Set([
      ...featuredItems.map((i) => i.id),
      ...categories.flatMap((c) => c.items.map((i) => i.id)),
    ]),
  ]);
  const mapItem = (item: ItemPayload) => {
    const base = effectivePrice(states.get(item.id), Number(item.price));
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      imageUrls: item.imageUrls,
      tag: item.tag,
      tags: item.tags,
      price: base,
      salePrice: salePriceOf(base, item.discountType, Number(item.discountValue ?? 0)),
      isAvailable: effectiveAvailable(states.get(item.id), item.isAvailable),
      availableNow: isItemAvailableNow(item, now),
      posOnly: item.posOnly,
      sortOrder: item.sortOrder,
      categoryId: item.categoryId,
      optionGroups: item.optionGroups.map((g) => ({
        id: g.id,
        name: g.name,
        required: g.required,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        choices: g.choices.map((ch) => ({
          id: ch.id,
          name: ch.name,
          priceDelta: Number(ch.priceDelta),
        })),
      })),
    };
  };

  const combos = await buildCombosForMenu(catalogueId, opts);

  return {
    featuredTitle: settings?.featuredTitle ?? 'Popular',
    takeawayCharge: Number(settings?.takeawayCharge ?? 0),
    combos,
    // Customer-menu hero banner. An empty image list / null copy falls back to
    // the default gradient/copy on the client; multiple images rotate.
    banner: {
      imageUrls: settings?.bannerImageUrls ?? [],
      title: settings?.bannerTitle ?? null,
      subtitle: settings?.bannerSubtitle ?? null,
    },
    // Master switch: hide the whole strip when the store has it turned off.
    // Items the outlet has hidden (offered-here = false) are dropped per outlet.
    featured:
      settings?.featuredEnabled === false
        ? []
        : featuredItems
            .filter((i) => scheduledIn(i) && offeredAtOutlet(states.get(i.id), i.isActive))
            .map(mapItem),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      items: c.items
        .filter((i) => scheduledIn(i) && offeredAtOutlet(states.get(i.id), i.isActive))
        .map(mapItem),
    })),
  };
}

/** Customer menu for a table (POS-only "secret" items hidden). */
export async function getMenuForTable(tableCode: string) {
  const { table, store } = await getTableByCode(tableCode);
  const menu = await buildStoreMenu(store.id, store.catalogueId, { includePosOnly: false });
  return { store, table, ...menu };
}

/**
 * The current OPEN tab for a table — the rounds + items ordered so far this
 * session, so a diner can review what the table has ordered. Public by table
 * code (consistent with ordering: anyone at the table shares the tab). Returns
 * `hasOpenTab: false` with empty rounds when nothing is open yet. Voided items
 * and cancelled rounds are excluded; the total is the running item subtotal
 * (bill-level discounts/charges are only finalised at settlement).
 */
export async function getOpenTabForTable(tableCode: string) {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const table = await prisma.table.findUnique({
    where: { code: tableCode },
    select: { id: true, name: true, isActive: true },
  });
  if (!table) throw ApiError.notFound(`Table "${tableCode}" was not found`);
  if (!table.isActive) throw ApiError.badRequest(`Table "${tableCode}" is not active`);

  const session = await prisma.tableSession.findFirst({
    where: { tableId: table.id, status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
    select: {
      sessionNumber: true,
      openedAt: true,
      orders: {
        where: { status: { not: 'CANCELLED' } },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          roundNumber: true,
          createdAt: true,
          items: {
            where: { voided: false },
            orderBy: { createdAt: 'asc' },
            select: { id: true, name: true, quantity: true, totalPrice: true, note: true },
          },
        },
      },
    },
  });

  if (!session) {
    return {
      tableName: table.name,
      hasOpenTab: false,
      sessionNumber: null,
      openedAt: null,
      rounds: [],
      itemCount: 0,
      total: 0,
    };
  }

  const rounds = session.orders
    .filter((o) => o.items.length > 0)
    .map((o) => ({
      id: o.id,
      roundNumber: o.roundNumber,
      createdAt: o.createdAt,
      items: o.items.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        totalPrice: Number(i.totalPrice),
        note: i.note,
      })),
    }));
  const itemCount = rounds.reduce((s, r) => s + r.items.reduce((x, i) => x + i.quantity, 0), 0);
  const total = round2(
    rounds.reduce((s, r) => s + r.items.reduce((x, i) => x + i.totalPrice, 0), 0),
  );

  return {
    tableName: table.name,
    hasOpenTab: true,
    sessionNumber: session.sessionNumber,
    openedAt: session.openedAt,
    rounds,
    itemCount,
    total,
  };
}

/**
 * Staff POS menu for a table — same shape as the customer menu, but INCLUDES
 * POS-only items (each flagged `posOnly`). Authenticated + guarded so an admin
 * only ever reads their own store's menu.
 */
export async function getPosMenuForTable(tableCode: string) {
  const { table, store } = await getTableByCode(tableCode);
  if (store.id !== currentStoreId()) {
    throw ApiError.notFound(`Table "${tableCode}" was not found`);
  }
  const menu = await buildStoreMenu(store.id, store.catalogueId, { includePosOnly: true });
  return { store, table, ...menu };
}
