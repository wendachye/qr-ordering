import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/response';
import { getDefaultStoreId } from '../../lib/store';

const round2 = (n: number) => Math.round(n * 100) / 100;
const normCode = (code: string) => code.trim().toUpperCase();

type VoucherRow = {
  id: string;
  code: string;
  description: string | null;
  discountType: string;
  discountValue: unknown;
  minSpend: unknown;
  maxRedemptions: number | null;
  redeemedCount: number;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toDto(v: VoucherRow) {
  return {
    id: v.id,
    code: v.code,
    description: v.description,
    discountType: v.discountType,
    discountValue: Number(v.discountValue),
    minSpend: Number(v.minSpend),
    maxRedemptions: v.maxRedemptions,
    redeemedCount: v.redeemedCount,
    expiresAt: v.expiresAt,
    isActive: v.isActive,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

// --- Validation / computation (shared by attach + settlement) ---

type VoucherCheck = {
  isActive: boolean;
  expiresAt: Date | null;
  maxRedemptions: number | null;
  redeemedCount: number;
  minSpend: unknown;
} | null;

/** Returns an error message if the voucher can't be used, else null. */
export function voucherError(v: VoucherCheck, billTotal: number): string | null {
  if (!v) return 'Voucher code not found';
  if (!v.isActive) return 'This voucher is no longer active';
  if (v.expiresAt && v.expiresAt.getTime() < Date.now()) return 'This voucher has expired';
  if (v.maxRedemptions != null && v.redeemedCount >= v.maxRedemptions) {
    return 'This voucher has reached its usage limit';
  }
  if (Number(v.minSpend) > 0 && billTotal < Number(v.minSpend)) {
    return `Minimum spend of ${Number(v.minSpend).toFixed(2)} not met`;
  }
  return null;
}

/** The RM discount a voucher gives against `base`, capped at base. */
export function voucherDiscountAmount(
  v: { discountType: string; discountValue: unknown },
  base: number,
): number {
  const val = Number(v.discountValue);
  let amt = v.discountType === 'PERCENT' ? base * (Math.min(100, val) / 100) : val;
  if (amt > base) amt = base;
  if (amt < 0) amt = 0;
  return round2(amt);
}

// --- Admin CRUD ---

export async function listVouchers() {
  const storeId = await getDefaultStoreId();
  const rows = await prisma.voucher.findMany({
    where: { storeId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toDto);
}

export async function createVoucher(input: {
  code: string;
  description?: string | null;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  minSpend?: number;
  maxRedemptions?: number | null;
  expiresAt?: string | null;
  isActive?: boolean;
}) {
  const storeId = await getDefaultStoreId();
  const code = normCode(input.code);
  const dup = await prisma.voucher.findUnique({ where: { storeId_code: { storeId, code } } });
  if (dup) throw ApiError.conflict('A voucher with this code already exists');
  const v = await prisma.voucher.create({
    data: {
      storeId,
      code,
      description: input.description?.trim() || null,
      discountType: input.discountType,
      discountValue: input.discountValue,
      minSpend: input.minSpend ?? 0,
      maxRedemptions: input.maxRedemptions ?? null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      isActive: input.isActive ?? true,
    },
  });
  return toDto(v);
}

export async function updateVoucher(
  id: string,
  input: {
    code?: string;
    description?: string | null;
    discountType?: 'PERCENT' | 'FIXED';
    discountValue?: number;
    minSpend?: number;
    maxRedemptions?: number | null;
    expiresAt?: string | null;
    isActive?: boolean;
  },
) {
  const storeId = await getDefaultStoreId();
  const existing = await prisma.voucher.findFirst({ where: { id, storeId } });
  if (!existing) throw ApiError.notFound('Voucher not found');

  const data: Record<string, unknown> = {};
  if (input.code !== undefined) {
    const code = normCode(input.code);
    if (code !== existing.code) {
      const dup = await prisma.voucher.findUnique({ where: { storeId_code: { storeId, code } } });
      if (dup) throw ApiError.conflict('A voucher with this code already exists');
    }
    data.code = code;
  }
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.discountType !== undefined) data.discountType = input.discountType;
  if (input.discountValue !== undefined) data.discountValue = input.discountValue;
  if (input.minSpend !== undefined) data.minSpend = input.minSpend;
  if (input.maxRedemptions !== undefined) data.maxRedemptions = input.maxRedemptions;
  if (input.expiresAt !== undefined)
    data.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  const v = await prisma.voucher.update({ where: { id }, data });
  return toDto(v);
}

/** Delete a voucher; once redeemed, deactivate instead (keeps the audit trail). */
export async function deleteVoucher(id: string) {
  const storeId = await getDefaultStoreId();
  const existing = await prisma.voucher.findFirst({ where: { id, storeId } });
  if (!existing) throw ApiError.notFound('Voucher not found');
  if (existing.redeemedCount > 0) {
    await prisma.voucher.update({ where: { id }, data: { isActive: false } });
    return { id, deactivated: true };
  }
  await prisma.voucher.delete({ where: { id } });
  return { id, deactivated: false };
}

// --- Public: validate + attach a voucher to a table's OPEN tab ---

export async function applyVoucherToTable(tableCode: string, rawCode: string) {
  const table = await prisma.table.findUnique({
    where: { code: tableCode },
    select: { id: true, storeId: true },
  });
  if (!table) throw ApiError.notFound('Table not found');
  const session = await prisma.tableSession.findFirst({
    where: { tableId: table.id, status: 'OPEN' },
    select: { id: true },
  });
  if (!session) throw ApiError.badRequest('No open tab for this table yet — add an item first.');

  const code = normCode(rawCode);
  const v = await prisma.voucher.findUnique({
    where: { storeId_code: { storeId: table.storeId, code } },
  });

  const orders = await prisma.order.findMany({
    where: { sessionId: session.id, status: { not: 'CANCELLED' } },
    select: { items: { where: { voided: false }, select: { totalPrice: true } } },
  });
  const billTotal = round2(
    orders.reduce((a, o) => a + o.items.reduce((x, it) => x + Number(it.totalPrice), 0), 0),
  );

  const err = voucherError(v, billTotal);
  if (err) throw ApiError.badRequest(err);

  await prisma.tableSession.update({ where: { id: session.id }, data: { voucherCode: code } });
  return {
    code: v!.code,
    discountType: v!.discountType,
    discountValue: Number(v!.discountValue),
    estimatedDiscount: voucherDiscountAmount(v!, billTotal),
  };
}
