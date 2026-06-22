import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/response';
import { parseTaxes } from '../admin/adminSettings.service';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Diner-facing receipt for a SETTLED tab. Public — the store is resolved from the
 * session (no tenant context), keyed by the session's (unguessable) id. Rebuilds
 * the tax-inclusive bill breakdown (subtotal → service charge → tax, the same
 * back-out as the Z-report) and lists the tenders, tip and any cash change. Only
 * a CLOSED tab has a receipt.
 */
export async function getReceipt(sessionId: string) {
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: {
      table: { select: { name: true } },
      store: { select: { name: true, logoUrl: true, serviceChargeRate: true, taxes: true } },
      orders: {
        where: { status: { not: 'CANCELLED' } },
        orderBy: { createdAt: 'asc' },
        select: {
          items: {
            where: { voided: false },
            orderBy: { createdAt: 'asc' },
            select: { name: true, quantity: true, unitPrice: true, totalPrice: true },
          },
        },
      },
      payments: {
        where: { voided: false },
        orderBy: { createdAt: 'asc' },
        select: { method: true, amount: true, tip: true, tendered: true },
      },
    },
  });
  if (!session) throw ApiError.notFound('Receipt not found');
  if (session.status !== 'CLOSED') {
    throw ApiError.notFound('Receipt not available — the bill is not settled');
  }

  const items = session.orders.flatMap((o) =>
    o.items.map((it) => ({
      name: it.name,
      quantity: it.quantity,
      unitPrice: Number(it.unitPrice),
      totalPrice: Number(it.totalPrice),
    })),
  );
  const gross = round2(items.reduce((acc, it) => acc + it.totalPrice, 0));
  const discount = round2(Number(session.discountAmount));
  const voucherDiscount = round2(Number(session.voucherDiscount));
  const net = round2(gross - discount - voucherDiscount);

  // Tax-inclusive back-out: decompose the collected net into a subtotal, the
  // service charge, and each configured tax (mirrors the sales report).
  const scRate = Number(session.store.serviceChargeRate ?? 0) / 100;
  const taxList = parseTaxes(session.store.taxes);
  const totalTaxRate = taxList.reduce((s, t) => s + t.rate / 100, 0);
  const base2 = net / (1 + totalTaxRate); // subtotal + service charge
  const serviceCharge = round2((base2 / (1 + scRate)) * scRate);
  const taxes = taxList.map((t) => ({
    name: t.name,
    rate: round2(t.rate),
    amount: round2(base2 * (t.rate / 100)),
  }));
  const totalTax = round2(taxes.reduce((s, t) => s + t.amount, 0));
  const subtotal = round2(net - serviceCharge - totalTax);

  const payments = session.payments.map((p) => ({
    method: p.method,
    amount: Number(p.amount),
    tip: Number(p.tip),
    tendered: p.tendered == null ? null : Number(p.tendered),
  }));
  const tip = round2(payments.reduce((acc, p) => acc + p.tip, 0));
  const total = round2(net + tip);
  // Cash change: anything tendered above the amount + tip on that payment.
  const change = round2(
    payments.reduce(
      (acc, p) => acc + (p.tendered != null ? Math.max(0, p.tendered - p.amount - p.tip) : 0),
      0,
    ),
  );

  return {
    receiptNumber: session.sessionNumber,
    storeName: session.store.name,
    logoUrl: session.store.logoUrl,
    tableName: session.table.name,
    pax: session.pax,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    charges: {
      serviceChargeRate: round2(scRate * 100),
      taxes: taxList.map((t) => ({ name: t.name, rate: round2(t.rate) })),
    },
    items,
    subtotal,
    serviceCharge,
    taxes,
    totalTax,
    discount,
    voucherCode: session.voucherCode,
    voucherDiscount,
    net,
    tip,
    total,
    payments,
    change,
    paymentMethod: session.paymentMethod,
  };
}
