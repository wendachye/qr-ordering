import { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/response';
import { getDefaultStoreId } from '../../lib/store';

// Item-level inventory (MVP). When a MenuItem has trackStock on, each sale
// decrements stockQty; reaching 0 auto-86s the item (isAvailable -> false). A
// StockAdjustment ledger row records every movement for audit. Untracked items
// behave exactly as before (unlimited).

type Tx = Prisma.TransactionClient;

export type StockReason = 'sale' | 'restock' | 'set' | 'waste' | 'void_restore';

export interface StockActor {
  id?: string | null;
  email?: string | null;
}

/**
 * Deduct stock for an order's lines (called INSIDE the order transaction so it
 * commits/rolls back atomically with the order). `deductions` maps a menuItemId
 * to the total quantity sold across the order (menu-item lines + combo
 * components are already summed by the caller). Only tracked items move; a
 * concurrency-safe conditional decrement prevents overselling.
 */
export async function applyStockDeductions(
  tx: Tx,
  storeId: string,
  deductions: Map<string, number>,
): Promise<void> {
  if (deductions.size === 0) return;
  const ids = [...deductions.keys()];

  // Which of these items actually track stock? (untracked = unlimited, skip)
  const tracked = await tx.menuItem.findMany({
    where: { id: { in: ids }, storeId, trackStock: true },
    select: { id: true, name: true },
  });
  if (tracked.length === 0) return;
  const nameById = new Map(tracked.map((t) => [t.id, t.name]));

  for (const item of tracked) {
    const qty = deductions.get(item.id) ?? 0;
    if (qty <= 0) continue;

    // Conditional decrement: only succeeds if enough stock is on hand. Under
    // concurrency the row lock + gte guard guarantees we never go negative.
    const res = await tx.menuItem.updateMany({
      where: { id: item.id, trackStock: true, stockQty: { gte: qty } },
      data: { stockQty: { decrement: qty } },
    });
    if (res.count === 0) {
      const cur = await tx.menuItem.findUnique({
        where: { id: item.id },
        select: { stockQty: true },
      });
      throw ApiError.badRequest(`Only ${cur?.stockQty ?? 0} of "${nameById.get(item.id)}" left`);
    }

    const after = await tx.menuItem.findUnique({
      where: { id: item.id },
      select: { stockQty: true },
    });
    const balanceAfter = after?.stockQty ?? 0;

    await tx.stockAdjustment.create({
      data: { storeId, menuItemId: item.id, delta: -qty, reason: 'sale', balanceAfter },
    });

    // Auto-86: a tracked item at zero is hidden / unorderable until restocked.
    if (balanceAfter <= 0) {
      await tx.menuItem.update({ where: { id: item.id }, data: { isAvailable: false } });
    }
  }
}

/**
 * Restore stock for a tracked item when a sale is reversed (item void / tab
 * cancel) — the inverse of applyStockDeductions. Increments stockQty, writes a
 * `void_restore` ledger row, and un-86s an item that was auto-disabled at zero.
 * Untracked items are skipped. Runs inside the caller's transaction.
 */
export async function restoreStock(
  tx: Tx,
  storeId: string,
  menuItemId: string,
  qty: number,
  actor?: StockActor,
): Promise<void> {
  if (qty <= 0) return;
  const item = await tx.menuItem.findFirst({
    where: { id: menuItemId, storeId },
    select: { trackStock: true, stockQty: true },
  });
  if (!item?.trackStock) return;
  const balanceAfter = item.stockQty + qty;
  await tx.menuItem.update({
    where: { id: menuItemId },
    data: {
      stockQty: balanceAfter,
      // Bring an auto-86'd item back when stock returns above zero.
      ...(item.stockQty <= 0 && balanceAfter > 0 ? { isAvailable: true } : {}),
    },
  });
  await tx.stockAdjustment.create({
    data: {
      storeId,
      menuItemId,
      delta: qty,
      reason: 'void_restore',
      balanceAfter,
      actorId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
    },
  });
}

/**
 * A manual stock move (restock / waste / correction). Positive delta adds,
 * negative removes (clamped at 0). A restock that brings a sold-out tracked item
 * back above 0 un-86s it (isAvailable -> true); a move to 0 auto-86s it.
 */
export async function adjustStock(
  menuItemId: string,
  input: { delta: number; reason: StockReason; note?: string | null },
  actor?: StockActor,
) {
  const storeId = await getDefaultStoreId();
  return prisma.$transaction(async (tx) => {
    const item = await tx.menuItem.findFirst({
      where: { id: menuItemId, storeId },
      select: { id: true, name: true, stockQty: true, trackStock: true },
    });
    if (!item) throw ApiError.notFound('Menu item not found');
    if (!item.trackStock) throw ApiError.badRequest('Stock tracking is off for this item');

    const balanceAfter = Math.max(0, item.stockQty + input.delta);
    const realDelta = balanceAfter - item.stockQty;

    await tx.menuItem.update({
      where: { id: item.id },
      data: {
        stockQty: balanceAfter,
        // Restocking above 0 re-enables; dropping to 0 auto-86s.
        ...(balanceAfter > 0 && item.stockQty <= 0 ? { isAvailable: true } : {}),
        ...(balanceAfter <= 0 ? { isAvailable: false } : {}),
      },
    });
    await tx.stockAdjustment.create({
      data: {
        storeId,
        menuItemId: item.id,
        delta: realDelta,
        reason: input.reason,
        note: input.note?.trim() ? input.note.trim() : null,
        balanceAfter,
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? null,
      },
    });

    return { id: item.id, stockQty: balanceAfter, isAvailable: balanceAfter > 0 };
  });
}

/**
 * Turn tracking on/off and/or set the absolute stock + low-stock threshold for
 * an item. Turning tracking on with a starting count writes a 'set' ledger row.
 */
export async function setStockConfig(
  menuItemId: string,
  input: { trackStock?: boolean; stockQty?: number; lowStockThreshold?: number | null },
  actor?: StockActor,
) {
  const storeId = await getDefaultStoreId();
  return prisma.$transaction(async (tx) => {
    const item = await tx.menuItem.findFirst({
      where: { id: menuItemId, storeId },
      select: { id: true, stockQty: true, trackStock: true, isAvailable: true },
    });
    if (!item) throw ApiError.notFound('Menu item not found');

    const nextQty = input.stockQty ?? item.stockQty;
    const nextTrack = input.trackStock ?? item.trackStock;
    const data: Prisma.MenuItemUpdateInput = {};
    if (input.trackStock !== undefined) data.trackStock = input.trackStock;
    if (input.lowStockThreshold !== undefined) data.lowStockThreshold = input.lowStockThreshold;
    if (input.stockQty !== undefined) {
      data.stockQty = nextQty;
      // Keep availability sensible when an absolute count is set on a tracked item.
      if (nextTrack) data.isAvailable = nextQty > 0;
    }

    await tx.menuItem.update({ where: { id: item.id }, data });

    // Record the absolute set as a ledger row (delta vs the prior count).
    if (input.stockQty !== undefined && nextQty !== item.stockQty) {
      await tx.stockAdjustment.create({
        data: {
          storeId,
          menuItemId: item.id,
          delta: nextQty - item.stockQty,
          reason: 'set',
          balanceAfter: nextQty,
          actorId: actor?.id ?? null,
          actorEmail: actor?.email ?? null,
        },
      });
    }
    return { id: item.id };
  });
}

/** Tracked items at or below their low-stock threshold (out-of-stock first). */
export async function listLowStock() {
  const storeId = await getDefaultStoreId();
  const items = await prisma.menuItem.findMany({
    where: { storeId, trackStock: true, lowStockThreshold: { not: null } },
    select: { id: true, name: true, stockQty: true, lowStockThreshold: true, isAvailable: true },
    orderBy: { stockQty: 'asc' },
  });
  return items
    .filter((i) => i.stockQty <= (i.lowStockThreshold ?? 0))
    .map((i) => ({
      id: i.id,
      name: i.name,
      stockQty: i.stockQty,
      lowStockThreshold: i.lowStockThreshold,
      isAvailable: i.isAvailable,
    }));
}

/** Recent stock-ledger entries for one item (newest first). */
export async function listStockLedger(menuItemId: string, limit = 50) {
  const storeId = await getDefaultStoreId();
  const item = await prisma.menuItem.findFirst({
    where: { id: menuItemId, storeId },
    select: { id: true },
  });
  if (!item) throw ApiError.notFound('Menu item not found');
  const rows = await prisma.stockAdjustment.findMany({
    where: { menuItemId, storeId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(200, limit),
  });
  return rows.map((r) => ({
    id: r.id,
    delta: r.delta,
    reason: r.reason,
    note: r.note,
    balanceAfter: r.balanceAfter,
    actorEmail: r.actorEmail,
    createdAt: r.createdAt,
  }));
}
