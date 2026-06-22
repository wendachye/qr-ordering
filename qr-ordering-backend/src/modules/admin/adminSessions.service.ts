import { Prisma, type SessionStatus } from '@prisma/client';

import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/response';
import { compareNatural } from '../../lib/sort';
import { getDefaultStoreId } from '../../lib/store';
import { floorEvents } from '../../lib/floorEvents';
import { voucherDiscountAmount, voucherError } from './vouchers.service';

type SelectedOption = { group: string; choice: string; priceDelta: number };

function parseSelectedOptions(value: Prisma.JsonValue | null | undefined): SelectedOption[] {
  return Array.isArray(value) ? (value as unknown as SelectedOption[]) : [];
}

/**
 * Floor view: every table with its OPEN session summary (or null when free).
 * Two queries — all tables + all open sessions with their rounds — stitched in
 * memory by tableId, so there is no per-table N+1. Cancelled rounds are
 * excluded from the running total / item count / round count.
 */
export async function getFloor() {
  const storeId = await getDefaultStoreId();
  const [tables, openSessions] = await Promise.all([
    prisma.table.findMany({
      where: { storeId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, isActive: true },
    }),
    prisma.tableSession.findMany({
      where: { storeId, status: 'OPEN' },
      select: {
        id: true,
        sessionNumber: true,
        status: true,
        pax: true,
        openedAt: true,
        tableId: true,
        discountAmount: true,
        voucherDiscount: true,
        payments: { where: { voided: false }, select: { amount: true } },
        orders: {
          where: { status: { not: 'CANCELLED' } },
          select: {
            total: true,
            items: { select: { quantity: true, voided: true } },
            printJobs: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } },
          },
        },
      },
    }),
  ]);

  const byTable = new Map(openSessions.map((s) => [s.tableId, s]));
  const entries = tables.map((t) => {
    const s = byTable.get(t.id);
    if (!s) return { table: t, session: null };
    const total = s.orders.reduce((acc, o) => acc + Number(o.total), 0);
    const totalItems = s.orders.reduce(
      (acc, o) => acc + o.items.reduce((x, i) => x + (i.voided ? 0 : i.quantity), 0),
      0,
    );
    const anyPrintFailed = s.orders.some((o) => o.printJobs[0]?.status === 'FAILED');
    // Part-paid tabs (split / partial settlement): how much is tendered so far and
    // what's still owed against the locked net.
    const amountPaid =
      Math.round(s.payments.reduce((acc, p) => acc + Number(p.amount), 0) * 100) / 100;
    const net =
      Math.round((total - Number(s.discountAmount) - Number(s.voucherDiscount)) * 100) / 100;
    const balanceDue = Math.round((net - amountPaid) * 100) / 100;
    return {
      table: t,
      session: {
        id: s.id,
        sessionNumber: s.sessionNumber,
        status: s.status,
        pax: s.pax,
        openedAt: s.openedAt,
        total,
        amountPaid,
        balanceDue,
        totalItems,
        roundCount: s.orders.length,
        anyPrintFailed,
      },
    };
  });

  // Show tables in natural sequence — "Table 2" before "Table 10".
  entries.sort((a, b) => compareNatural(a.table.name, b.table.name));
  return entries;
}

/**
 * Full session detail: the table + every round (Order) with its items, selected
 * options and latest print status. Totals exclude cancelled rounds, but
 * cancelled rounds are still returned (the UI shows them struck through).
 */
export async function getSession(id: string) {
  const storeId = await getDefaultStoreId();
  const session = await prisma.tableSession.findFirst({
    where: { id, storeId },
    include: {
      table: { select: { id: true, name: true, code: true, isActive: true } },
      orders: {
        orderBy: { createdAt: 'asc' },
        include: {
          items: { orderBy: { createdAt: 'asc' } },
          printJobs: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } },
        },
      },
      payments: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!session) throw ApiError.notFound('Session not found');

  const rounds = session.orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    roundNumber: o.roundNumber,
    status: o.status,
    createdAt: o.createdAt,
    // Totals exclude voided items (kept on the list, struck through).
    totalItems: o.items.reduce((sum, i) => sum + (i.voided ? 0 : i.quantity), 0),
    total: o.items.reduce((sum, i) => sum + (i.voided ? 0 : Number(i.totalPrice)), 0),
    printStatus: o.printJobs[0]?.status ?? null,
    items: o.items.map((i) => ({
      id: i.id,
      menuItemId: i.menuItemId,
      name: i.name,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      totalPrice: Number(i.totalPrice),
      note: i.note,
      selectedOptions: parseSelectedOptions(i.selectedOptions),
      isTakeaway: i.isTakeaway,
      takeawayCharge: Number(i.takeawayCharge),
      priceOverridden: i.priceOverridden,
      discountType: i.discountType,
      discountValue: Number(i.discountValue),
      discountAmount: Number(i.discountAmount),
      voided: i.voided,
      voidReason: i.voidReason,
    })),
  }));

  const billable = rounds.filter((r) => r.status !== 'CANCELLED');
  const total = billable.reduce((acc, r) => acc + r.total, 0);
  const discount = Number(session.discountAmount);
  const voucherDiscount = Number(session.voucherDiscount);
  const netTotal = Math.round((total - discount - voucherDiscount) * 100) / 100;

  // Tenders against the tab. A tab settles in one payment (single method) or
  // several (split / partial). `amountPaid` is money toward the bill; tips are
  // tracked separately (on top). Voided tenders don't count.
  const payments = session.payments.map((p) => ({
    id: p.id,
    method: p.method,
    amount: Number(p.amount),
    tip: Number(p.tip),
    tendered: p.tendered == null ? null : Number(p.tendered),
    reference: p.reference,
    voided: p.voided,
    createdAt: p.createdAt,
  }));
  const live = payments.filter((p) => !p.voided);
  const amountPaid = Math.round(live.reduce((acc, p) => acc + p.amount, 0) * 100) / 100;
  const tipTotal = Math.round(live.reduce((acc, p) => acc + p.tip, 0) * 100) / 100;

  return {
    id: session.id,
    sessionNumber: session.sessionNumber,
    status: session.status,
    pax: session.pax,
    paymentMethod: session.paymentMethod,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    table: session.table,
    total,
    // Bill-level discount (0 until settled with one) and the resulting net.
    discountType: session.discountType,
    discountValue: Number(session.discountValue),
    discount,
    // Voucher applied to the tab (attached by a customer or at settlement).
    voucherCode: session.voucherCode,
    voucherDiscount,
    netTotal,
    // Tenders: the payment ledger + the running paid / tip totals and what's
    // still owed (> 0 while a tab is part-paid).
    payments,
    amountPaid,
    tipTotal,
    balanceDue: Math.round((netTotal - amountPaid) * 100) / 100,
    totalItems: billable.reduce((acc, r) => acc + r.totalItems, 0),
    roundCount: billable.length,
    rounds,
  };
}

/**
 * Record a tender against an OPEN tab. The bill-level discount + voucher are
 * resolved on the FIRST payment and then locked on the session, so every split
 * tender settles the same net (later payments ignore any discount/voucher input).
 * `amount` is the portion to apply now — omit it (or pass ≥ the balance) to settle
 * the remaining balance in full. When the running paid total reaches the net the
 * tab closes (rounds completed, voucher redeemed once). A tip rides on top and
 * never counts toward the balance. All money is computed server-side so a tampered
 * client can't under-charge.
 */
export async function recordPayment(
  id: string,
  input: {
    paymentMethod: string;
    amount?: number;
    tip?: number;
    tendered?: number;
    reference?: string;
    discountType?: 'PERCENT' | 'FIXED';
    discountValue?: number;
    voucherCode?: string;
  },
) {
  const storeId = await getDefaultStoreId();
  await prisma.$transaction(async (tx) => {
    const s = await tx.tableSession.findFirst({
      where: { id, storeId },
      select: {
        status: true,
        voucherCode: true,
        voucherDiscount: true,
        discountType: true,
        discountValue: true,
        discountAmount: true,
      },
    });
    if (!s) throw ApiError.notFound('Session not found');
    if (s.status !== 'OPEN') throw ApiError.conflict('This table is already closed');

    // Tab gross: non-voided items on non-cancelled rounds (server-authoritative).
    const orders = await tx.order.findMany({
      where: { sessionId: id, status: { not: 'CANCELLED' } },
      select: { items: { where: { voided: false }, select: { totalPrice: true } } },
    });
    const gross = orders.reduce(
      (acc, o) => acc.add(o.items.reduce((x, it) => x.add(it.totalPrice), new Prisma.Decimal(0))),
      new Prisma.Decimal(0),
    );

    // Prior tenders (non-voided). The first payment locks the discount + voucher.
    const prior = await tx.payment.findMany({
      where: { sessionId: id, voided: false },
      select: { amount: true },
    });
    const isFirst = prior.length === 0;

    let discountType: string | null = s.discountType;
    let discountValue = new Prisma.Decimal(s.discountValue);
    let discountAmount = new Prisma.Decimal(s.discountAmount);
    let voucherCode: string | null = s.voucherCode;
    let voucherDiscount = new Prisma.Decimal(s.voucherDiscount);

    if (isFirst) {
      // --- Bill-level discount on the tab gross. ---
      discountType = null;
      discountValue = new Prisma.Decimal(0);
      discountAmount = new Prisma.Decimal(0);
      if (input.discountType && input.discountValue && input.discountValue > 0) {
        discountType = input.discountType;
        discountValue = new Prisma.Decimal(input.discountValue);
        discountAmount =
          input.discountType === 'PERCENT'
            ? gross.mul(Math.min(100, input.discountValue)).div(100)
            : discountValue;
        if (discountAmount.greaterThan(gross)) discountAmount = gross;
        discountAmount = discountAmount.toDecimalPlaces(2);
        // A discount that rounds to nothing has no money effect — drop the metadata.
        if (discountAmount.isZero()) {
          discountType = null;
          discountValue = new Prisma.Decimal(0);
        }
      }
      const afterBill = gross.sub(discountAmount);

      // --- Voucher: a staff-provided code wins; else the customer-attached one.
      // A stale attached voucher simply doesn't apply (a staff one errors loudly). ---
      const strict = input.voucherCode !== undefined && input.voucherCode.trim() !== '';
      const code = (input.voucherCode !== undefined ? input.voucherCode : (s.voucherCode ?? ''))
        .trim()
        .toUpperCase();
      voucherCode = null;
      voucherDiscount = new Prisma.Decimal(0);
      if (code) {
        const v = await tx.voucher.findUnique({ where: { storeId_code: { storeId, code } } });
        const err = voucherError(v, Number(gross));
        if (err) {
          if (strict) throw ApiError.badRequest(err);
        } else {
          const amt = voucherDiscountAmount(v!, Number(afterBill));
          if (amt > 0) {
            voucherDiscount = new Prisma.Decimal(amt);
            voucherCode = code;
          }
        }
      }

      // Lock the bill values on the session so later tenders read them.
      await tx.tableSession.update({
        where: { id },
        data: { discountType, discountValue, discountAmount, voucherCode, voucherDiscount },
      });
    }

    // Net to collect (≥ 0) and what's outstanding after prior tenders.
    let net = gross.sub(discountAmount).sub(voucherDiscount);
    if (net.isNegative()) net = new Prisma.Decimal(0);
    const paidSoFar = prior.reduce((acc, p) => acc.add(p.amount), new Prisma.Decimal(0));
    const balance = net.sub(paidSoFar);
    if (balance.lessThanOrEqualTo(0)) throw ApiError.conflict('This tab is already fully paid');

    // Amount applied to the bill this tender — capped at the balance (cash given
    // above the balance is change, tracked via `tendered`, not applied to the bill).
    let applied =
      input.amount == null ? balance : new Prisma.Decimal(input.amount).toDecimalPlaces(2);
    if (applied.greaterThan(balance)) applied = balance;
    if (applied.lessThanOrEqualTo(0)) throw ApiError.badRequest('Enter an amount to pay');

    const tip =
      input.tip && input.tip > 0
        ? new Prisma.Decimal(input.tip).toDecimalPlaces(2)
        : new Prisma.Decimal(0);
    const tendered =
      input.tendered != null && input.tendered > 0
        ? new Prisma.Decimal(input.tendered).toDecimalPlaces(2)
        : null;

    await tx.payment.create({
      data: {
        storeId,
        sessionId: id,
        method: input.paymentMethod,
        amount: applied.toDecimalPlaces(2),
        tip,
        tendered,
        reference: input.reference?.trim() || null,
      },
    });

    // Settle when the running paid total reaches the net (½-cent tolerance).
    const settled = paidSoFar.add(applied).greaterThanOrEqualTo(net.sub(new Prisma.Decimal('0.005')));
    if (!settled) return; // partial — tab stays OPEN with a balance owing

    // Redeem the (locked) voucher exactly once, at close.
    if (voucherCode) {
      const already = await tx.voucherRedemption.findFirst({
        where: { sessionId: id },
        select: { id: true },
      });
      if (!already) {
        const v = await tx.voucher.findUnique({ where: { storeId_code: { storeId, code: voucherCode } } });
        if (v) {
          await tx.voucher.update({ where: { id: v.id }, data: { redeemedCount: { increment: 1 } } });
          await tx.voucherRedemption.create({
            data: { voucherId: v.id, storeId, sessionId: id, code: voucherCode, amount: voucherDiscount },
          });
        }
      }
    }

    // Summarise the tender method: a single method, or "Split" across several.
    const methods = await tx.payment.findMany({
      where: { sessionId: id, voided: false },
      select: { method: true },
    });
    const distinct = [...new Set(methods.map((m) => m.method))];
    const methodSummary = distinct.length === 1 ? distinct[0] : 'Split';

    await tx.tableSession.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date(), paymentMethod: methodSummary },
    });
    await tx.order.updateMany({
      where: { sessionId: id, status: 'NEW' },
      data: { status: 'COMPLETED' },
    });
  });
  floorEvents.emit(storeId);
  return getSession(id);
}

/**
 * Settle the tab in full: record a single tender for the whole remaining balance
 * (+ an optional bill-level discount / voucher / tip) and close it. Thin wrapper
 * over recordPayment — the split / partial path is the same ledger.
 */
export async function closeSession(
  id: string,
  input: {
    paymentMethod: string;
    discountType?: 'PERCENT' | 'FIXED';
    discountValue?: number;
    voucherCode?: string;
    tip?: number;
  },
) {
  return recordPayment(id, { ...input, amount: undefined });
}

/** Void the tab: cancel the session and all of its rounds. */
export async function cancelSession(id: string) {
  const storeId = await getDefaultStoreId();
  await prisma.$transaction(async (tx) => {
    const s = await tx.tableSession.findFirst({ where: { id, storeId }, select: { status: true } });
    if (!s) throw ApiError.notFound('Session not found');
    if (s.status !== 'OPEN') throw ApiError.conflict('This table is already closed');
    await tx.tableSession.update({
      where: { id },
      data: { status: 'CANCELLED', closedAt: new Date() },
    });
    await tx.order.updateMany({
      where: { sessionId: id },
      data: { status: 'CANCELLED' },
    });
  });
  floorEvents.emit(storeId);
  return getSession(id);
}

/** Set how many guests (pax / covers) are seated on a tab. */
export async function setSessionPax(id: string, pax: number) {
  const storeId = await getDefaultStoreId();
  const s = await prisma.tableSession.findFirst({ where: { id, storeId }, select: { id: true } });
  if (!s) throw ApiError.notFound('Session not found');
  await prisma.tableSession.update({ where: { id }, data: { pax } });
  floorEvents.emit(storeId);
  return getSession(id);
}

/**
 * Re-open a previously CLOSED tab onto its table (e.g. closed by mistake). Only
 * works when the table has no other OPEN session.
 */
export async function reopenSession(id: string) {
  const storeId = await getDefaultStoreId();
  await prisma.$transaction(async (tx) => {
    const s = await tx.tableSession.findFirst({
      where: { id, storeId },
      select: { status: true, tableId: true },
    });
    if (!s) throw ApiError.notFound('Session not found');
    if (s.status !== 'CLOSED') throw ApiError.conflict('Only a closed tab can be re-opened');
    const openOnTable = await tx.tableSession.findFirst({
      where: { tableId: s.tableId, status: 'OPEN' },
      select: { id: true },
    });
    if (openOnTable) throw ApiError.conflict('This table already has an open tab');
    await tx.tableSession.update({
      where: { id },
      // Clear any settled discount so it can't bleed into the re-opened tab's
      // live net (the discount is re-entered at the next close if still wanted).
      data: {
        status: 'OPEN',
        closedAt: null,
        discountType: null,
        discountValue: 0,
        discountAmount: 0,
      },
    });
    // Drop the prior tender ledger — those payments settled the now-reversed
    // close; they're re-recorded at the next close (mirrors the discount reset).
    await tx.payment.deleteMany({ where: { sessionId: id } });
    await tx.order.updateMany({
      where: { sessionId: id, status: 'COMPLETED' },
      data: { status: 'NEW' },
    });
  });
  floorEvents.emit(storeId);
  return getSession(id);
}

/** Move an open tab (and its rounds) to another free, active table. */
export async function moveSession(id: string, targetTableId: string) {
  const storeId = await getDefaultStoreId();
  const session = await prisma.tableSession.findFirst({
    where: { id, storeId },
    select: { id: true, status: true, tableId: true, storeId: true },
  });
  if (!session) throw ApiError.notFound('Session not found');
  if (session.status !== 'OPEN') throw ApiError.conflict('Only an open tab can be moved');
  if (session.tableId === targetTableId) {
    throw ApiError.badRequest('The tab is already on this table');
  }
  const target = await prisma.table.findUnique({
    where: { id: targetTableId },
    select: { id: true, isActive: true, storeId: true },
  });
  if (!target || target.storeId !== session.storeId) {
    throw ApiError.notFound('Target table not found');
  }
  if (!target.isActive) throw ApiError.badRequest('Target table is not active');
  const openOnTarget = await prisma.tableSession.findFirst({
    where: { tableId: targetTableId, status: 'OPEN' },
    select: { id: true },
  });
  if (openOnTarget) {
    throw ApiError.conflict('That table already has an open tab — combine instead');
  }

  await prisma.$transaction(async (tx) => {
    await tx.tableSession.update({ where: { id }, data: { tableId: targetTableId } });
    await tx.order.updateMany({ where: { sessionId: id }, data: { tableId: targetTableId } });
  });
  floorEvents.emit(storeId);
  return getSession(id);
}

/**
 * Combine another open tab (source) INTO this one (target): the source's rounds
 * move onto the target's table, the merged tab's rounds are renumbered
 * chronologically, and the source tab is marked MERGED (freeing its table).
 */
export async function combineSessions(targetId: string, sourceId: string) {
  if (targetId === sourceId) throw ApiError.badRequest('Pick a different table to combine');
  const storeId = await getDefaultStoreId();
  const [target, source] = await Promise.all([
    prisma.tableSession.findFirst({
      where: { id: targetId, storeId },
      select: { id: true, status: true, tableId: true, storeId: true },
    }),
    prisma.tableSession.findFirst({
      where: { id: sourceId, storeId },
      select: { id: true, status: true, storeId: true },
    }),
  ]);
  if (!target) throw ApiError.notFound('Session not found');
  if (!source) throw ApiError.notFound('The other tab was not found');
  if (target.status !== 'OPEN' || source.status !== 'OPEN') {
    throw ApiError.conflict('Both tabs must be open to combine');
  }
  if (target.storeId !== source.storeId) {
    throw ApiError.badRequest('Tabs belong to different stores');
  }

  await prisma.$transaction(async (tx) => {
    // Move the source's rounds onto the target table + session.
    await tx.order.updateMany({
      where: { sessionId: sourceId },
      data: { sessionId: targetId, tableId: target.tableId },
    });
    // Renumber the combined tab's rounds chronologically.
    const orders = await tx.order.findMany({
      where: { sessionId: targetId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    for (let i = 0; i < orders.length; i++) {
      await tx.order.update({ where: { id: orders[i].id }, data: { roundNumber: i + 1 } });
    }
    // The source tab is now empty → mark merged so its table frees up.
    await tx.tableSession.update({
      where: { id: sourceId },
      data: { status: 'MERGED', closedAt: new Date() },
    });
  });
  floorEvents.emit(storeId);
  return getSession(targetId);
}

/**
 * History list of session summaries. Defaults to closed + cancelled (the open
 * ones live on the floor); pass a status to narrow, and/or a table to scope.
 */
export async function listSessions(status?: SessionStatus, tableId?: string) {
  const storeId = await getDefaultStoreId();
  const sessions = await prisma.tableSession.findMany({
    where: {
      storeId,
      ...(tableId ? { tableId } : {}),
      ...(status ? { status } : { status: { in: ['CLOSED', 'CANCELLED'] } }),
    },
    orderBy: { openedAt: 'desc' },
    take: 200,
    select: {
      id: true,
      sessionNumber: true,
      status: true,
      openedAt: true,
      closedAt: true,
      table: { select: { name: true } },
      orders: {
        where: { status: { not: 'CANCELLED' } },
        select: { total: true, items: { select: { quantity: true } } },
      },
    },
  });
  return sessions.map((s) => ({
    id: s.id,
    sessionNumber: s.sessionNumber,
    status: s.status,
    tableName: s.table.name,
    openedAt: s.openedAt,
    closedAt: s.closedAt,
    total: s.orders.reduce((acc, o) => acc + Number(o.total), 0),
    totalItems: s.orders.reduce((acc, o) => acc + o.items.reduce((x, i) => x + i.quantity, 0), 0),
    roundCount: s.orders.length,
  }));
}
