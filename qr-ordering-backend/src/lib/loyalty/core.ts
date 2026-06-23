import { Prisma } from '@prisma/client';

import { ApiError } from '../response';

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

/* ------------------------- Settlement (earn / redeem) ------------------------- */

// Points earned for a spend at a tier multiplier (floored; never negative).
export function pointsForSpend(
  netSpend: number,
  earnRatePoints: number,
  earnMultiplier: number,
): number {
  if (!(netSpend > 0) || !(earnRatePoints > 0)) return 0;
  // toFixed(6) collapses float noise (e.g. 0.29 × 100 = 28.9999996) before floor,
  // so an exact integer product isn't under-earned by a point at high earn rates.
  return Math.max(0, Math.floor(Number((netSpend * earnRatePoints * (earnMultiplier || 1)).toFixed(6))));
}

type SettleConfig = {
  earnRatePoints: number;
  tiers: TierDef[];
  tierBasis: string;
};

// Burn any locked points redemption + grant earned points when a member's tab
// settles. Called exactly once, inside the OPEN→CLOSED transition, so it is
// idempotent by construction. Writes the REDEEM/EARN ledger rows (keeping the
// balance==ledger invariant via applyPoints), bumps lifetimeSpend, recomputes
// the tier, and stamps session.pointsEarned. Returns the points earned.
export async function settleLoyaltyAtClose(
  tx: Prisma.TransactionClient,
  args: {
    storeId: string;
    sessionId: string;
    memberId: string;
    pointsRedeemed: number; // locked on the session by the redeem endpoint
    netSpend: number; // post-discount net the member pays (excl. tip)
    config: SettleConfig;
  },
): Promise<number> {
  const member = await tx.member.findUniqueOrThrow({ where: { id: args.memberId } });

  // Redeem: burn the locked points. Guard against a balance drained elsewhere
  // between locking the redemption and settling.
  if (args.pointsRedeemed > 0) {
    if (member.pointsBalance < args.pointsRedeemed) {
      throw ApiError.badRequest(
        'Member no longer has enough points to redeem — remove the redemption',
      );
    }
    await applyPoints(tx, {
      memberId: member.id,
      storeId: args.storeId,
      type: 'REDEEM',
      points: -args.pointsRedeemed,
      reason: 'Redeemed at settlement',
      sessionId: args.sessionId,
    });
  }

  // Earn at the member's CURRENT tier multiplier (a tier upgrade applies next
  // visit), on the net they actually paid (the redemption discount is excluded
  // because it's already netted out of netSpend).
  const basis =
    args.config.tierBasis === 'LIFETIME_SPEND' ? Number(member.lifetimeSpend) : member.lifetimePoints;
  const mult = tierFor(basis, args.config.tiers).earnMultiplier;
  const earned = pointsForSpend(args.netSpend, args.config.earnRatePoints, mult);
  if (earned > 0) {
    await applyPoints(tx, {
      memberId: member.id,
      storeId: args.storeId,
      type: 'EARN',
      points: earned,
      reason: 'Earned on settled bill',
      sessionId: args.sessionId,
    });
  }

  if (args.netSpend > 0) {
    await tx.member.update({
      where: { id: member.id },
      data: { lifetimeSpend: { increment: new Prisma.Decimal(round2(args.netSpend)) } },
    });
  }
  const fresh = await tx.member.findUniqueOrThrow({ where: { id: member.id } });
  await recomputeTier(tx, fresh, { tierBasis: args.config.tierBasis, tiers: args.config.tiers });
  await tx.tableSession.update({ where: { id: args.sessionId }, data: { pointsEarned: earned } });
  return earned;
}

// Reverse the loyalty effects of a settled tab when it is re-opened: claw back
// earned points (balance + lifetimePoints), restore redeemed points (balance),
// and unwind lifetimeSpend. Mirrors settleLoyaltyAtClose; writes ADJUST ledger
// rows so the reversal is auditable and the balance==ledger invariant holds.
export async function reverseLoyaltyAtReopen(
  tx: Prisma.TransactionClient,
  args: {
    storeId: string;
    sessionId: string;
    memberId: string | null;
    pointsEarned: number;
    pointsRedeemed: number;
    netSpend: number;
    config: { tiers: TierDef[]; tierBasis: string };
  },
): Promise<void> {
  if (!args.memberId) return;
  if (args.pointsEarned === 0 && args.pointsRedeemed === 0 && args.netSpend === 0) return;
  const member = await tx.member.findUnique({ where: { id: args.memberId } });
  if (!member) return;
  // Don't let clawing back earned points drive the balance negative (the member
  // spent them elsewhere before this reopen) — reject so staff adjust manually.
  if (member.pointsBalance + args.pointsRedeemed < args.pointsEarned) {
    throw ApiError.badRequest(
      'Member has already spent the points earned on this tab — adjust manually before reopening',
    );
  }

  if (args.pointsEarned > 0) {
    await tx.pointsLedger.create({
      data: {
        memberId: member.id,
        storeId: args.storeId,
        type: 'ADJUST',
        points: -args.pointsEarned,
        reason: 'Reopen — reverse earned points',
        sessionId: args.sessionId,
      },
    });
  }
  if (args.pointsRedeemed > 0) {
    await tx.pointsLedger.create({
      data: {
        memberId: member.id,
        storeId: args.storeId,
        type: 'ADJUST',
        points: args.pointsRedeemed,
        reason: 'Reopen — restore redeemed points',
        sessionId: args.sessionId,
      },
    });
  }
  await tx.member.update({
    where: { id: member.id },
    // Net ledger delta keeps balance==ledger; lifetimePoints/lifetimeSpend are
    // cumulative bases (clamped at 0, not part of the ledger-sum invariant).
    data: {
      pointsBalance: { increment: args.pointsRedeemed - args.pointsEarned },
      lifetimePoints: Math.max(0, member.lifetimePoints - args.pointsEarned),
      lifetimeSpend: new Prisma.Decimal(round2(Math.max(0, Number(member.lifetimeSpend) - args.netSpend))),
      lastActivityAt: new Date(),
    },
  });
  const fresh = await tx.member.findUniqueOrThrow({ where: { id: member.id } });
  await recomputeTier(tx, fresh, { tierBasis: args.config.tierBasis, tiers: args.config.tiers });
}
