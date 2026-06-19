import { Prisma } from '@prisma/client';

// Shared loyalty primitives: phone normalisation, tier math, the points-ledger
// invariant, and DTO mappers. Reused by the admin module, settlement, the
// public (customer) surface, and the daily jobs.

export const round2 = (n: number) => Math.round(n * 100) / 100;

// Normalise a phone to a comparable key: keep a single leading "+", strip every
// other non-digit. We don't validate the country here — just canonicalise so
// "012-345 6789" and "0123456789" map to the same member.
export function normPhone(raw: string): string {
  const trimmed = (raw ?? '').trim();
  const plus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  return (plus ? '+' : '') + digits;
}

export type TierDef = { tier: string; threshold: number; earnMultiplier: number };

// Parse the Store.tierThresholds JSON into a clean, ascending ladder.
export function parseTiers(raw: unknown): TierDef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => (t && typeof t === 'object' ? (t as Record<string, unknown>) : {}))
    .map((t) => ({
      tier: String(t.tier ?? '').trim(),
      threshold: Math.max(0, Math.floor(Number(t.threshold ?? 0)) || 0),
      earnMultiplier: Number(t.earnMultiplier ?? 1) || 1,
    }))
    .filter((t) => t.tier.length > 0)
    .sort((a, b) => a.threshold - b.threshold);
}

// The tier a member qualifies for given their basis value (lifetime points or
// spend) and the ladder. Falls back to BRONZE / multiplier 1 below the first rung.
export function tierFor(
  basisValue: number,
  tiers: TierDef[],
): { tier: string; earnMultiplier: number } {
  let current = { tier: 'BRONZE', earnMultiplier: 1 };
  for (const t of [...tiers].sort((a, b) => a.threshold - b.threshold)) {
    if (basisValue >= t.threshold) current = { tier: t.tier, earnMultiplier: t.earnMultiplier };
  }
  return current;
}

export type PointsType = 'EARN' | 'REDEEM' | 'ADJUST' | 'EXPIRE' | 'BONUS';

// The ONLY way to mutate a member's points balance: write a signed ledger row
// AND the matching balance delta in the same transaction, so the denormalised
// `pointsBalance` always equals the sum of the ledger. EARN/BONUS (positive)
// also raise `lifetimePoints` (the tier basis); redeem/expire never lower it.
export async function applyPoints(
  tx: Prisma.TransactionClient,
  args: {
    memberId: string;
    storeId: string;
    type: PointsType;
    points: number; // signed
    reason?: string | null;
    sessionId?: string | null;
    expiresAt?: Date | null;
    touchActivity?: boolean; // default true (an EXPIRE sweep passes false)
  },
): Promise<void> {
  await tx.pointsLedger.create({
    data: {
      memberId: args.memberId,
      storeId: args.storeId,
      type: args.type,
      points: args.points,
      reason: args.reason ?? null,
      sessionId: args.sessionId ?? null,
      expiresAt: args.expiresAt ?? null,
    },
  });
  const raisesLifetime = (args.type === 'EARN' || args.type === 'BONUS') && args.points > 0;
  await tx.member.update({
    where: { id: args.memberId },
    data: {
      pointsBalance: { increment: args.points },
      ...(raisesLifetime ? { lifetimePoints: { increment: args.points } } : {}),
      ...(args.touchActivity === false ? {} : { lastActivityAt: new Date() }),
    },
  });
}

// Add a stamp ledger row + the matching stampCount delta in the same tx.
export async function applyStamps(
  tx: Prisma.TransactionClient,
  args: {
    memberId: string;
    storeId: string;
    delta: number;
    reason?: string | null;
    sessionId?: string | null;
  },
): Promise<void> {
  await tx.stampLedger.create({
    data: {
      memberId: args.memberId,
      storeId: args.storeId,
      delta: args.delta,
      reason: args.reason ?? null,
      sessionId: args.sessionId ?? null,
    },
  });
  await tx.member.update({
    where: { id: args.memberId },
    data: { stampCount: { increment: args.delta } },
  });
}

// Recompute + persist a member's cached tier from the configured ladder + basis.
export async function recomputeTier(
  tx: Prisma.TransactionClient,
  member: { id: string; lifetimePoints: number; lifetimeSpend: unknown; tier: string },
  config: { tierBasis: string; tiers: TierDef[] },
): Promise<string> {
  const basis =
    config.tierBasis === 'LIFETIME_SPEND' ? Number(member.lifetimeSpend) : member.lifetimePoints;
  const next = tierFor(basis, config.tiers).tier;
  if (next !== member.tier) {
    await tx.member.update({ where: { id: member.id }, data: { tier: next } });
  }
  return next;
}

type MemberRow = {
  id: string;
  phone: string;
  name: string | null;
  birthday: Date | null;
  pointsBalance: number;
  lifetimePoints: number;
  lifetimeSpend: unknown;
  tier: string;
  stampCount: number;
  consentMarketing: boolean;
  joinedAt: Date;
  lastActivityAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function memberDto(m: MemberRow) {
  return {
    id: m.id,
    phone: m.phone,
    name: m.name,
    birthday: m.birthday ? m.birthday.toISOString().slice(0, 10) : null,
    pointsBalance: m.pointsBalance,
    lifetimePoints: m.lifetimePoints,
    lifetimeSpend: Number(m.lifetimeSpend),
    tier: m.tier,
    stampCount: m.stampCount,
    consentMarketing: m.consentMarketing,
    joinedAt: m.joinedAt,
    lastActivityAt: m.lastActivityAt,
    isActive: m.isActive,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

// A birthday string ("YYYY-MM-DD") → a UTC Date at midnight, or null.
export function parseBirthday(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
