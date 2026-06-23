import { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/response';
import { getDefaultStoreId } from '../../lib/store';
import { getReceipt } from '../public/receipt.service';
import {
  buildMyInvoisDocument,
  getSubmissionAdapter,
  type InvoiceParty,
  type MyInvoisDocument,
} from '../../lib/myinvois';
import type { EinvoiceSettingsInput, IssueInvoiceInput } from '../../validators/einvoice';

const SELLER_SELECT = {
  name: true,
  einvoiceEnabled: true,
  einvoiceMode: true,
  sellerTin: true,
  sellerRegistrationNo: true,
  sellerSstNo: true,
  sellerMsic: true,
  sellerAddress: true,
  sellerEmail: true,
  sellerPhone: true,
} satisfies Prisma.StoreSelect;

export async function getEinvoiceSettings() {
  const storeId = await getDefaultStoreId();
  const s = await prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: SELLER_SELECT });
  return {
    storeName: s.name,
    einvoiceEnabled: s.einvoiceEnabled,
    einvoiceMode: s.einvoiceMode,
    sellerTin: s.sellerTin,
    sellerRegistrationNo: s.sellerRegistrationNo,
    sellerSstNo: s.sellerSstNo,
    sellerMsic: s.sellerMsic,
    sellerAddress: s.sellerAddress,
    sellerEmail: s.sellerEmail,
    sellerPhone: s.sellerPhone,
  };
}

export async function updateEinvoiceSettings(input: EinvoiceSettingsInput) {
  const storeId = await getDefaultStoreId();
  await prisma.store.update({ where: { id: storeId }, data: input });
  return getEinvoiceSettings();
}

// Sequential, gapless invoice number per store, reset per fiscal year:
// "INV-2026-000123". The InvoiceCounter row is upserted then conditionally
// incremented inside the issue transaction, so concurrent issues serialize on
// the row lock and never collide (the @@unique([storeId, number]) is a backstop).
async function nextInvoiceNumber(tx: Prisma.TransactionClient, storeId: string): Promise<string> {
  const year = new Date().getFullYear();
  await tx.invoiceCounter.upsert({
    where: { storeId },
    create: { storeId, lastSeq: 0, year },
    update: {},
  });
  // Atomic reset-or-increment: the year-rollover reset is a guarded updateMany
  // (WHERE year < currentYear) so two issues racing across the year boundary
  // can't both emit ...-000001 — the loser falls through to the increment.
  const reset = await tx.invoiceCounter.updateMany({
    where: { storeId, year: { lt: year } },
    data: { lastSeq: 1, year },
  });
  const seq =
    reset.count === 1
      ? 1
      : (
          await tx.invoiceCounter.update({
            where: { storeId },
            data: { lastSeq: { increment: 1 } },
          })
        ).lastSeq;
  return `INV-${year}-${String(seq).padStart(6, '0')}`;
}

type InvoiceRow = Prisma.InvoiceGetPayload<object>;

function toInvoiceDto(inv: InvoiceRow, opts: { includeDocument?: boolean } = {}) {
  return {
    id: inv.id,
    sessionId: inv.sessionId,
    number: inv.number,
    status: inv.status,
    buyerName: inv.buyerName,
    buyerTin: inv.buyerTin,
    buyerRegistrationNo: inv.buyerRegistrationNo,
    buyerEmail: inv.buyerEmail,
    buyerPhone: inv.buyerPhone,
    buyerAddress: inv.buyerAddress,
    currency: inv.currency,
    subtotal: Number(inv.subtotal),
    serviceCharge: Number(inv.serviceCharge),
    taxTotal: Number(inv.taxTotal),
    total: Number(inv.total),
    submissionUid: inv.submissionUid,
    longId: inv.longId,
    validationUrl: inv.validationUrl,
    qrCode: inv.qrCode,
    rejectionReason: inv.rejectionReason,
    submittedAt: inv.submittedAt,
    validatedAt: inv.validatedAt,
    createdAt: inv.createdAt,
    ...(opts.includeDocument ? { document: inv.document } : {}),
  };
}

/**
 * Issue (or return the existing) tax invoice for a SETTLED tab. Reuses the
 * receipt's tax-inclusive breakdown so the invoice money matches the bill
 * exactly. Idempotent: a session has at most one invoice.
 */
export async function issueInvoiceForSession(sessionId: string, input: IssueInvoiceInput) {
  const storeId = await getDefaultStoreId();
  const session = await prisma.tableSession.findFirst({
    where: { id: sessionId, storeId },
    include: { invoice: true, store: { select: SELLER_SELECT } },
  });
  if (!session) throw ApiError.notFound('Tab not found');
  if (session.status !== 'CLOSED') {
    throw ApiError.badRequest('Only a settled tab can be invoiced');
  }
  if (session.invoice) return toInvoiceDto(session.invoice, { includeDocument: true });

  const s = session.store;
  if (!s.sellerTin) {
    throw ApiError.badRequest('Set your seller TIN in Settings → e-Invoice before issuing invoices');
  }
  if (!s.einvoiceEnabled) {
    throw ApiError.badRequest('Turn on e-Invoice in Settings → e-Invoice first');
  }

  // Reuse the diner-receipt breakdown (items + tax-inclusive money). `net` is the
  // taxable, tax-inclusive bill (excludes gratuity).
  const receipt = await getReceipt(sessionId);
  const lines = receipt.items.map((it) => ({
    description: it.name,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    amount: it.totalPrice,
  }));
  const supplier: InvoiceParty = {
    name: s.name,
    tin: s.sellerTin,
    registrationNo: s.sellerRegistrationNo,
    sstNo: s.sellerSstNo,
    msic: s.sellerMsic,
    email: s.sellerEmail,
    phone: s.sellerPhone,
    address: s.sellerAddress,
  };
  const buyer: InvoiceParty = {
    name: input.buyerName ?? null,
    tin: input.buyerTin ?? null,
    registrationNo: input.buyerRegistrationNo ?? null,
    email: input.buyerEmail ?? null,
    phone: input.buyerPhone ?? null,
    address: input.buyerAddress ?? null,
  };
  const issuedAt = new Date();

  const invoice = await prisma.$transaction(async (tx) => {
    const number = await nextInvoiceNumber(tx, storeId);
    const doc = buildMyInvoisDocument({
      invoiceNumber: number,
      issuedAt,
      supplier,
      buyer,
      lines,
      money: {
        currency: 'MYR',
        subtotal: receipt.subtotal,
        serviceCharge: receipt.serviceCharge,
        taxes: receipt.taxes,
        taxTotal: receipt.totalTax,
        total: receipt.net,
        allowance: receipt.discount + receipt.voucherDiscount + receipt.loyaltyDiscount,
      },
    });
    return tx.invoice.create({
      data: {
        storeId,
        sessionId,
        number,
        buyerName: buyer.name,
        buyerTin: buyer.tin,
        buyerRegistrationNo: buyer.registrationNo,
        buyerEmail: buyer.email,
        buyerPhone: buyer.phone,
        buyerAddress: buyer.address,
        currency: 'MYR',
        subtotal: receipt.subtotal,
        serviceCharge: receipt.serviceCharge,
        taxTotal: receipt.totalTax,
        total: receipt.net,
        document: doc as unknown as Prisma.InputJsonValue,
        status: 'draft',
      },
    });
  });
  return toInvoiceDto(invoice, { includeDocument: true });
}

/** Submit a draft invoice to MyInvois via the store's adapter (sandbox stub). */
export async function submitInvoice(invoiceId: string) {
  const storeId = await getDefaultStoreId();
  const inv = await prisma.invoice.findFirst({
    where: { id: invoiceId, storeId },
    include: { store: { select: { einvoiceMode: true } } },
  });
  if (!inv) throw ApiError.notFound('Invoice not found');
  if (inv.status === 'valid' || inv.status === 'submitted') {
    return toInvoiceDto(inv, { includeDocument: true });
  }

  const adapter = getSubmissionAdapter(inv.store.einvoiceMode);
  try {
    const result = await adapter.submit(inv.document as unknown as MyInvoisDocument);
    const updated = await prisma.invoice.update({
      where: { id: inv.id },
      data: {
        status: result.status,
        submissionUid: result.submissionUid,
        longId: result.longId,
        validationUrl: result.validationUrl,
        qrCode: result.qrCode,
        rejectionReason: null,
        submittedAt: new Date(),
        validatedAt: result.status === 'valid' ? new Date() : null,
      },
    });
    return toInvoiceDto(updated, { includeDocument: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Submission failed';
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { status: 'invalid', rejectionReason: message },
    });
    throw ApiError.badRequest(message);
  }
}

export async function getInvoice(invoiceId: string) {
  const storeId = await getDefaultStoreId();
  const inv = await prisma.invoice.findFirst({ where: { id: invoiceId, storeId } });
  if (!inv) throw ApiError.notFound('Invoice not found');
  return toInvoiceDto(inv, { includeDocument: true });
}

export async function getInvoiceForSession(sessionId: string) {
  const storeId = await getDefaultStoreId();
  const inv = await prisma.invoice.findFirst({ where: { sessionId, storeId } });
  return inv ? toInvoiceDto(inv, { includeDocument: true }) : null;
}

export async function listInvoices(params: { limit?: number; offset?: number } = {}) {
  const storeId = await getDefaultStoreId();
  const limit = Math.min(100, params.limit ?? 50);
  const offset = params.offset ?? 0;
  const [total, rows] = await Promise.all([
    prisma.invoice.count({ where: { storeId } }),
    prisma.invoice.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
  ]);
  return { total, limit, offset, invoices: rows.map((r) => toInvoiceDto(r)) };
}
