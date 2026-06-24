import { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/response';
import { getCurrentCatalogueId, getDefaultStoreId } from '../../lib/store';

// Per-OUTLET item inventory. Stock lives on MenuItemOutletState (storeId,
// menuItemId) so each outlet on a shared brand catalogue tracks its own count.
// When an outlet has trackStock on, each sale decrements its stockQty; reaching 0
// auto-86s the item AT THAT OUTLET (isAvailableOverride -> false). A StockAdjustment
// ledger row records every movement. Untracked (no row / trackStock off) =
// unlimited, the original behaviour. The catalogue item (MenuItem) is shared and
// carries no stock; existence checks are catalogue-scoped, stock is store-scoped.

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
 * components are already summed by the caller). Only items the ORDERING outlet
 * tracks move; a concurrency-safe conditional decrement prevents overselling.
 */
export async function applyStockDeductions(
  tx: Tx,
  storeId: string,
  deductions: Map<string, number>,
): Promise<void> {
  if (deductions.size === 0) return;
  const ids = [...deductions.keys()];

  // Which of these items does this outlet actually track? (untracked = unlimited)
  const tracked = await tx.menuItemOutletState.findMany({
    where: { storeId, menuItemId: { in: ids }, trackStock: true },
    select: { menuItemId: true, menuItem: { select: { name: true } } },
  });
  if (tracked.length === 0) return;
  const nameById = new Map(tracked.map((t) => [t.menuItemId, t.menuItem.name]));

  for (const t of tracked) {
    const menuItemId = t.menuItemId;
    const qty = deductions.get(menuItemId) ?? 0;
    if (qty <= 0) continue;
    const key = { storeId_menuItemId: { storeId, menuItemId } };

    // Conditional decrement: only succeeds if enough stock is on hand. Under
    // concurrency the row lock + gte guard guarantees we never go negative.
    const res = await tx.menuItemOutletState.updateMany({
      where: { storeId, menuItemId, trackStock: true, stockQty: { gte: qty } },
      data: { stockQty: { decrement: qty } },
    });
    if (res.count === 0) {
      const cur = await tx.menuItemOutletState.findUnique({
        where: key,
        select: { stockQty: true },
      });
      throw ApiError.badRequest(`Only ${cur?.stockQty ?? 0} of "${nameById.get(menuItemId)}" left`);
    }

    const after = await tx.menuItemOutletState.findUnique({
      where: key,
      select: { stockQty: true },
    });
    const balanceAfter = after?.stockQty ?? 0;

    await tx.stockAdjustment.create({
      data: { storeId, menuItemId, delta: -qty, reason: 'sale', balanceAfter },
    });

    // Auto-86 at this outlet: a tracked item at zero is hidden / unorderable
    // here (only here) until restocked.
    if (balanceAfter <= 0) {
      await tx.menuItemOutletState.update({ where: key, data: { isAvailableOverride: false } });
    }
  }
}

/**
 * Restore stock for a tracked item when a sale is reversed (item void / tab
 * cancel) — the inverse of applyStockDeductions. Increments the outlet's stockQty,
 * writes a `void_restore` ledger row, and un-86s an item that was auto-disabled at
 * zero. Items the outlet doesn't track are skipped. Runs in the caller's tx.
 */
export async function restoreStock(
  tx: Tx,
  storeId: string,
  menuItemId: string,
  qty: number,
  actor?: StockActor,
): Promise<void> {
  if (qty <= 0) return;
  const key = { storeId_menuItemId: { storeId, menuItemId } };
  const state = await tx.menuItemOutletState.findUnique({
    where: key,
    select: { trackStock: true, stockQty: true },
  });
  if (!state?.trackStock) return;
  const balanceAfter = state.stockQty + qty;
  await tx.menuItemOutletState.update({
    where: key,
    data: {
      stockQty: balanceAfter,
      // Bring an auto-86'd item back when stock returns above zero.
      ...(state.stockQty <= 0 && balanceAfter > 0 ? { isAvailableOverride: true } : {}),
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
 * A manual stock move (restock / waste / correction) for the current outlet.
 * Positive delta adds, negative removes (clamped at 0). A restock that brings a
 * sold-out tracked item back above 0 un-86s it here; a move to 0 auto-86s it here.
 */
export async function adjustStock(
  menuItemId: string,
  input: { delta: number; reason: StockReason; note?: string | null },
  actor?: StockActor,
) {
  const storeId = await getDefaultStoreId();
  const catalogueId = await getCurrentCatalogueId();
  return prisma.$transaction(async (tx) => {
    // The item must be in this outlet's catalogue (shared menu is editable here).
    const item = await tx.menuItem.findFirst({
      where: { id: menuItemId, catalogueId },
      select: { id: true },
    });
    if (!item) throw ApiError.notFound('Menu item not found');

    const key = { storeId_menuItemId: { storeId, menuItemId } };
    const state = await tx.menuItemOutletState.findUnique({
      where: key,
      select: { stockQty: true, trackStock: true },
    });
    if (!state?.trackStock) throw ApiError.badRequest('Stock tracking is off for this item');

    const balanceAfter = Math.max(0, state.stockQty + input.delta);
    const realDelta = balanceAfter - state.stockQty;

    await tx.menuItemOutletState.update({
      where: key,
      data: {
        stockQty: balanceAfter,
        // Restocking above 0 re-enables here; dropping to 0 auto-86s here.
        ...(balanceAfter > 0 && state.stockQty <= 0 ? { isAvailableOverride: true } : {}),
        ...(balanceAfter <= 0 ? { isAvailableOverride: false } : {}),
      },
    });
    await tx.stockAdjustment.create({
      data: {
        storeId,
        menuItemId,
        delta: realDelta,
        reason: input.reason,
        note: input.note?.trim() ? input.note.trim() : null,
        balanceAfter,
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? null,
      },
    });

    return { id: menuItemId, stockQty: balanceAfter, isAvailable: balanceAfter > 0 };
  });
}

/**
 * Turn tracking on/off and/or set the absolute stock + low-stock threshold for an
 * item AT THE CURRENT OUTLET (upserts the per-outlet state row). Turning tracking
 * on with a starting count writes a 'set' ledger row.
 */
export async function setStockConfig(
  menuItemId: string,
  input: { trackStock?: boolean; stockQty?: number; lowStockThreshold?: number | null },
  actor?: StockActor,
) {
  const storeId = await getDefaultStoreId();
  const catalogueId = await getCurrentCatalogueId();
  return prisma.$transaction(async (tx) => {
    const item = await tx.menuItem.findFirst({
      where: { id: menuItemId, catalogueId },
      select: { id: true },
    });
    if (!item) throw ApiError.notFound('Menu item not found');

    const key = { storeId_menuItemId: { storeId, menuItemId } };
    const state = await tx.menuItemOutletState.findUnique({
      where: key,
      select: { stockQty: true, trackStock: true },
    });
    const prevQty = state?.stockQty ?? 0;
    const nextQty = input.stockQty ?? prevQty;
    const nextTrack = input.trackStock ?? state?.trackStock ?? false;

    const sets: {
      trackStock?: boolean;
      lowStockThreshold?: number | null;
      stockQty?: number;
      isAvailableOverride?: boolean | null;
    } = {};
    if (input.trackStock !== undefined) sets.trackStock = input.trackStock;
    if (input.lowStockThreshold !== undefined) sets.lowStockThreshold = input.lowStockThreshold;
    if (input.stockQty !== undefined) {
      sets.stockQty = nextQty;
      // Keep this outlet's availability sensible when an absolute count is set.
      if (nextTrack) sets.isAvailableOverride = nextQty > 0;
    }

    await tx.menuItemOutletState.upsert({
      where: key,
      create: { storeId, menuItemId, ...sets },
      update: sets,
    });

    // Record the absolute set as a ledger row (delta vs the prior count).
    if (input.stockQty !== undefined && nextQty !== prevQty) {
      await tx.stockAdjustment.create({
        data: {
          storeId,
          menuItemId,
          delta: nextQty - prevQty,
          reason: 'set',
          balanceAfter: nextQty,
          actorId: actor?.id ?? null,
          actorEmail: actor?.email ?? null,
        },
      });
    }
    return { id: menuItemId };
  });
}

/** This outlet's tracked items at or below their low-stock threshold (OOS first). */
export async function listLowStock() {
  const storeId = await getDefaultStoreId();
  const rows = await prisma.menuItemOutletState.findMany({
    where: { storeId, trackStock: true, lowStockThreshold: { not: null } },
    select: {
      menuItemId: true,
      stockQty: true,
      lowStockThreshold: true,
      isAvailableOverride: true,
      menuItem: { select: { name: true, isAvailable: true } },
    },
    orderBy: { stockQty: 'asc' },
  });
  return rows
    .filter((r) => r.stockQty <= (r.lowStockThreshold ?? 0))
    .map((r) => ({
      id: r.menuItemId,
      name: r.menuItem.name,
      stockQty: r.stockQty,
      lowStockThreshold: r.lowStockThreshold,
      // Effective availability at this outlet (override wins, else catalogue).
      isAvailable: r.isAvailableOverride ?? r.menuItem.isAvailable,
    }));
}

/** Recent stock-ledger entries for one item at the current outlet (newest first). */
export async function listStockLedger(menuItemId: string, limit = 50) {
  const storeId = await getDefaultStoreId();
  const catalogueId = await getCurrentCatalogueId();
  const item = await prisma.menuItem.findFirst({
    where: { id: menuItemId, catalogueId },
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
