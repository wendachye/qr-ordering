import bcrypt from 'bcryptjs';

import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/response';
import { getDefaultStoreId } from '../../lib/store';
import {
  featureLockedError,
  hasFeature,
  resolveEntitlementsForStore,
} from '../../lib/entitlements';

// Normalise the stored taxes JSON into a clean { name, rate }[] list.
export function parseTaxes(raw: unknown): { name: string; rate: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => (t && typeof t === 'object' ? (t as Record<string, unknown>) : {}))
    .map((t) => ({ name: String(t.name ?? '').trim(), rate: Number(t.rate ?? 0) }))
    .filter((t) => t.name.length > 0 && Number.isFinite(t.rate));
}

export async function getSettings() {
  const storeId = await getDefaultStoreId();
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      name: true,
      logoUrl: true,
      featuredTitle: true,
      takeawayCharge: true,
      serviceChargeRate: true,
      taxes: true,
      overridePinHash: true,
      voidPinRequired: true,
      discountPinRequired: true,
      overridePinRequired: true,
      paymentMethods: true,
    },
  });
  return {
    storeName: store?.name ?? '',
    logoUrl: store?.logoUrl ?? null,
    featuredTitle: store?.featuredTitle ?? 'Popular',
    takeawayCharge: Number(store?.takeawayCharge ?? 0),
    serviceChargeRate: Number(store?.serviceChargeRate ?? 0),
    taxes: parseTaxes(store?.taxes),
    pinConfigured: !!store?.overridePinHash,
    voidPinRequired: store?.voidPinRequired ?? false,
    discountPinRequired: store?.discountPinRequired ?? true,
    overridePinRequired: store?.overridePinRequired ?? true,
    paymentMethods: store?.paymentMethods ?? [],
  };
}

export async function updateSettings(input: {
  storeName?: string;
  logoUrl?: string | null;
  featuredTitle?: string;
  takeawayCharge?: number;
  serviceChargeRate?: number;
  taxes?: { name: string; rate: number }[];
  voidPinRequired?: boolean;
  discountPinRequired?: boolean;
  overridePinRequired?: boolean;
  paymentMethods?: string[];
}) {
  const storeId = await getDefaultStoreId();

  // Multiple taxes + a service charge are the "tax_multi" feature. A single tax
  // and no service charge are allowed on every plan, so only gate when the update
  // would actually set more than one tax or a non-zero service charge.
  const wantsMultiTax = (input.taxes?.length ?? 0) > 1;
  const wantsServiceCharge = (input.serviceChargeRate ?? 0) > 0;
  if (wantsMultiTax || wantsServiceCharge) {
    const ent = await resolveEntitlementsForStore(storeId);
    if (!hasFeature(ent, 'tax_multi')) throw featureLockedError('tax_multi');
  }

  // Can't require a PIN for any action before a PIN exists.
  if (
    input.voidPinRequired === true ||
    input.discountPinRequired === true ||
    input.overridePinRequired === true
  ) {
    const s = await prisma.store.findUnique({
      where: { id: storeId },
      select: { overridePinHash: true },
    });
    if (!s?.overridePinHash) {
      throw ApiError.badRequest('Set an override PIN before requiring it');
    }
  }

  await prisma.store.update({
    where: { id: storeId },
    data: {
      ...(input.storeName !== undefined ? { name: input.storeName } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl || null } : {}),
      ...(input.featuredTitle !== undefined ? { featuredTitle: input.featuredTitle } : {}),
      ...(input.takeawayCharge !== undefined ? { takeawayCharge: input.takeawayCharge } : {}),
      ...(input.serviceChargeRate !== undefined
        ? { serviceChargeRate: input.serviceChargeRate }
        : {}),
      ...(input.taxes !== undefined ? { taxes: input.taxes } : {}),
      ...(input.voidPinRequired !== undefined ? { voidPinRequired: input.voidPinRequired } : {}),
      ...(input.discountPinRequired !== undefined
        ? { discountPinRequired: input.discountPinRequired }
        : {}),
      ...(input.overridePinRequired !== undefined
        ? { overridePinRequired: input.overridePinRequired }
        : {}),
      ...(input.paymentMethods !== undefined ? { paymentMethods: input.paymentMethods } : {}),
    },
  });
  return getSettings();
}

/**
 * Set/change the override PIN. Requires the signed-in admin's password (so only
 * a manager can change it). A wrong password returns { ok:false } at 200 — NOT a
 * 401 — so the admin client doesn't treat it as an expired session.
 */
export async function setOverridePin(adminId: string, currentPassword: string, pin: string) {
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) throw ApiError.unauthorized('Account no longer exists');
  const ok = await bcrypt.compare(currentPassword, admin.password);
  if (!ok) return { ok: false as const };

  const storeId = await getDefaultStoreId();
  const overridePinHash = await bcrypt.hash(pin, 10);
  await prisma.store.update({ where: { id: storeId }, data: { overridePinHash } });
  return { ok: true as const };
}

/** Verify the override PIN. Returns { ok, configured } at 200. */
export async function verifyOverridePin(pin: string) {
  const storeId = await getDefaultStoreId();
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { overridePinHash: true },
  });
  if (!store?.overridePinHash) return { ok: false, configured: false };
  const ok = await bcrypt.compare(pin, store.overridePinHash);
  return { ok, configured: true };
}
