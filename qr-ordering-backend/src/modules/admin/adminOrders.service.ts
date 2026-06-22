import { Prisma, type OrderStatus } from '@prisma/client';

import { prisma } from '../../lib/prisma';
import { getDefaultStoreId } from '../../lib/store';
import { floorEvents } from '../../lib/floorEvents';
import { ApiError } from '../../lib/response';
import { buildKitchenPayload } from '../../lib/printPayload';
import { getSession } from './adminSessions.service';
import { verifyOverridePin } from './adminSettings.service';
import type { UpdateOrderStatusInput } from '../../validators/order';

type SelectedOption = { group: string; choice: string; priceDelta: number };

function parseSelectedOptions(value: Prisma.JsonValue | null | undefined): SelectedOption[] {
  return Array.isArray(value) ? (value as unknown as SelectedOption[]) : [];
}

const orderDetailInclude = {
  table: true,
  items: { orderBy: { createdAt: 'asc' } },
  printJobs: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

function toOrderDetail(order: OrderWithRelations) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    note: order.note,
    tableId: order.tableId,
    tableName: order.table.name,
    tableCode: order.table.code,
    subtotal: Number(order.subtotal),
    total: Number(order.total),
    totalItems: order.items.reduce((s, i) => s + i.quantity, 0),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.items.map((i) => ({
      id: i.id,
      menuItemId: i.menuItemId,
      name: i.name,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      totalPrice: Number(i.totalPrice),
      note: i.note,
      selectedOptions: parseSelectedOptions(i.selectedOptions),
    })),
    printJobs: order.printJobs.map((p) => ({
      id: p.id,
      status: p.status,
      error: p.error,
      retryCount: p.retryCount,
      createdAt: p.createdAt,
      printedAt: p.printedAt,
    })),
  };
}

/**
 * Lists orders for the admin. NEW orders are surfaced first, then the most
 * recent completed/cancelled orders. Polled by the admin UI every few seconds.
 */
export async function listOrders(statusFilter?: OrderStatus) {
  const storeId = await getDefaultStoreId();
  const orders = await prisma.order.findMany({
    where: { storeId, ...(statusFilter ? { status: statusFilter } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      table: { select: { name: true } },
      items: { select: { quantity: true } },
      printJobs: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } },
    },
  });

  const mapped = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    tableName: o.table.name,
    totalItems: o.items.reduce((s, i) => s + i.quantity, 0),
    total: Number(o.total),
    printStatus: o.printJobs[0]?.status ?? null,
    createdAt: o.createdAt,
  }));

  // NEW first (newest within group), then everything else newest-first.
  const rank = (s: OrderStatus) => (s === 'NEW' ? 0 : 1);
  mapped.sort((a, b) => {
    const r = rank(a.status) - rank(b.status);
    if (r !== 0) return r;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return mapped;
}

/**
 * A table's order history: every order placed at the table, newest first, each
 * with its items + selected options and latest print status.
 */
export async function listTableOrders(tableId: string) {
  const storeId = await getDefaultStoreId();
  const orders = await prisma.order.findMany({
    where: { tableId, storeId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      table: { select: { code: true } },
      items: { orderBy: { createdAt: 'asc' } },
      printJobs: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } },
    },
  });
  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    roundNumber: o.roundNumber,
    sessionId: o.sessionId,
    tableCode: o.table.code,
    status: o.status,
    createdAt: o.createdAt,
    total: Number(o.total),
    totalItems: o.items.reduce((s, i) => s + i.quantity, 0),
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
      voided: i.voided,
      voidReason: i.voidReason,
    })),
  }));
}

export async function getOrder(id: string) {
  const storeId = await getDefaultStoreId();
  const order = await prisma.order.findFirst({
    where: { id, storeId },
    include: orderDetailInclude,
  });
  if (!order) throw ApiError.notFound('Order not found');
  return toOrderDetail(order);
}

export async function updateOrderStatus(id: string, input: UpdateOrderStatusInput) {
  const storeId = await getDefaultStoreId();
  const existing = await prisma.order.findFirst({ where: { id, storeId } });
  if (!existing) throw ApiError.notFound('Order not found');

  const order = await prisma.order.update({
    where: { id },
    data: { status: input.status },
    include: orderDetailInclude,
  });
  return toOrderDetail(order);
}

/** Queues a fresh kitchen ticket for an existing order. */
export async function reprintOrder(id: string) {
  const storeId = await getDefaultStoreId();
  const order = await prisma.order.findFirst({
    where: { id, storeId },
    include: { table: true, items: { orderBy: { createdAt: 'asc' } } },
  });
  if (!order) throw ApiError.notFound('Order not found');

  const payload = buildKitchenPayload({
    orderNumber: order.orderNumber,
    tableName: order.table.name,
    createdAt: order.createdAt,
    note: order.note,
    items: order.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      note: i.note,
      options: parseSelectedOptions(i.selectedOptions).map((o) => `${o.group}: ${o.choice}`),
      takeaway: i.isTakeaway,
    })),
  });

  const job = await prisma.printJob.create({
    data: {
      orderId: order.id,
      status: 'PENDING',
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  });

  return { printJobId: job.id, status: job.status };
}

/**
 * Void a single item on an OPEN tab (customer cancelled / out of stock). The
 * item stays for the record (struck through, with reason); the parent order's
 * total is recomputed from its remaining items. Voiding requires the override
 * PIN only when the store has that toggle on.
 */
export async function voidOrderItem(
  itemId: string,
  reason: string | undefined,
  pin: string | undefined,
) {
  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: {
      order: {
        select: {
          id: true,
          storeId: true,
          sessionId: true,
          session: { select: { status: true } },
        },
      },
    },
  });
  const storeId = await getDefaultStoreId();
  if (!item || item.order.storeId !== storeId) throw ApiError.notFound('Item not found');
  if (item.voided) throw ApiError.badRequest('This item is already voided');
  const sessionId = item.order.sessionId;
  if (!sessionId || item.order.session?.status !== 'OPEN') {
    throw ApiError.conflict('Items can only be voided on an open tab');
  }

  // PIN gate — only enforced when the store requires it.
  const store = await prisma.store.findUnique({
    where: { id: item.order.storeId },
    select: { voidPinRequired: true },
  });
  if (store?.voidPinRequired) {
    const res = await verifyOverridePin(pin ?? '');
    if (!res.ok) {
      throw ApiError.forbidden(
        res.configured ? 'Incorrect PIN' : 'Set an override PIN in Settings first',
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderItem.update({
      where: { id: itemId },
      data: {
        voided: true,
        voidReason: reason?.trim() ? reason.trim() : null,
        voidedAt: new Date(),
      },
    });
    // Recompute the order total from its non-voided items.
    const remaining = await tx.orderItem.findMany({
      where: { orderId: item.orderId },
      select: { totalPrice: true, voided: true },
    });
    const subtotal = remaining.reduce(
      (acc, i) => (i.voided ? acc : acc.add(new Prisma.Decimal(i.totalPrice))),
      new Prisma.Decimal(0),
    );
    await tx.order.update({
      where: { id: item.orderId },
      data: { subtotal, total: subtotal },
    });
  });

  floorEvents.emit(storeId);
  return getSession(sessionId);
}
