import { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/response';
import { getDefaultStoreId } from '../../lib/store';
import {
  applyPoints,
  memberDto,
  normPhone,
  parseBirthday,
  parseTiers,
  recomputeTier,
  type TierDef,
} from '../../lib/loyalty/core';
import type {
  CreateMemberInput,
  CreateRewardInput,
  LoyaltyConfigInput,
  UpdateMemberInput,
  UpdateRewardInput,
} from '../../validators/loyalty';

/* ----------------------------- Program config ----------------------------- */

const LOYALTY_CONFIG_SELECT = {
  loyaltyEnabled: true,
  pointsEnabled: true,
  stampsEnabled: true,
  earnRatePoints: true,
  redeemRatePoints: true,
  minRedeemPoints: true,
  maxRedeemPercent: true,
  pointsExpiryMonths: true,
  welcomeBonusPoints: true,
  birthdayBonusPoints: true,
  stampThreshold: true,
  stampMinSpend: true,
  stampRewardType: true,
  stampRewardValue: true,
  stampRewardItemId: true,
  tierThresholds: true,
  tierBasis: true,
} satisfies Prisma.StoreSelect;

type ConfigRow = {
  loyaltyEnabled: boolean;
  pointsEnabled: boolean;
  stampsEnabled: boolean;
  earnRatePoints: Prisma.Decimal;
  redeemRatePoints: number;
  minRedeemPoints: number;
  maxRedeemPercent: Prisma.Decimal;
  pointsExpiryMonths: number | null;
  welcomeBonusPoints: number;
  birthdayBonusPoints: number;
  stampThreshold: number;
  stampMinSpend: Prisma.Decimal;
  stampRewardType: string | null;
  stampRewardValue: Prisma.Decimal;
  stampRewardItemId: string | null;
  tierThresholds: Prisma.JsonValue;
  tierBasis: string;
};

export type LoyaltyConfig = {
  loyaltyEnabled: boolean;
  pointsEnabled: boolean;
  stampsEnabled: boolean;
  earnRatePoints: number;
  redeemRatePoints: number;
  minRedeemPoints: number;
  maxRedeemPercent: number;
  pointsExpiryMonths: number | null;
  welcomeBonusPoints: number;
  birthdayBonusPoints: number;
  stampThreshold: number;
  stampMinSpend: number;
  stampRewardType: string | null;
  stampRewardValue: number;
  stampRewardItemId: string | null;
  tiers: TierDef[];
  tierBasis: string;
};

function toConfig(row: ConfigRow): LoyaltyConfig {
  return {
    loyaltyEnabled: row.loyaltyEnabled,
    pointsEnabled: row.pointsEnabled,
    stampsEnabled: row.stampsEnabled,
    earnRatePoints: Number(row.earnRatePoints),
    redeemRatePoints: row.redeemRatePoints,
    minRedeemPoints: row.minRedeemPoints,
    maxRedeemPercent: Number(row.maxRedeemPercent),
    pointsExpiryMonths: row.pointsExpiryMonths,
    welcomeBonusPoints: row.welcomeBonusPoints,
    birthdayBonusPoints: row.birthdayBonusPoints,
    stampThreshold: row.stampThreshold,
    stampMinSpend: Number(row.stampMinSpend),
    stampRewardType: row.stampRewardType,
    stampRewardValue: Number(row.stampRewardValue),
    stampRewardItemId: row.stampRewardItemId,
    tiers: parseTiers(row.tierThresholds),
    tierBasis: row.tierBasis,
  };
}

// Load the parsed program config for a store (used by enrol, adjust, settlement).
export async function loadConfig(storeId: string): Promise<LoyaltyConfig> {
  const row = await prisma.store.findUnique({
    where: { id: storeId },
    select: LOYALTY_CONFIG_SELECT,
  });
  if (!row) throw ApiError.notFound('Store not found');
  return toConfig(row as ConfigRow);
}

function configDto(c: LoyaltyConfig) {
  const { tiers, ...rest } = c;
  return { ...rest, tierThresholds: tiers };
}

export async function getLoyaltyConfig() {
  const storeId = await getDefaultStoreId();
  return configDto(await loadConfig(storeId));
}

export async function updateLoyaltyConfig(input: LoyaltyConfigInput) {
  const storeId = await getDefaultStoreId();
  const data: Prisma.StoreUpdateInput = {};
  const scalarKeys = [
    'loyaltyEnabled',
    'pointsEnabled',
    'stampsEnabled',
    'earnRatePoints',
    'redeemRatePoints',
    'minRedeemPoints',
    'maxRedeemPercent',
    'pointsExpiryMonths',
    'welcomeBonusPoints',
    'birthdayBonusPoints',
    'stampThreshold',
    'stampMinSpend',
    'stampRewardType',
    'stampRewardValue',
    'stampRewardItemId',
    'tierBasis',
  ] as const;
  for (const k of scalarKeys) {
    if (input[k] !== undefined) (data as Record<string, unknown>)[k] = input[k];
  }
  if (input.tierThresholds !== undefined) {
    data.tierThresholds = input.tierThresholds as unknown as Prisma.InputJsonValue;
  }
  await prisma.store.update({ where: { id: storeId }, data });
  return getLoyaltyConfig();
}

/* -------------------------------- Members -------------------------------- */

export async function listMembers(search?: string) {
  const storeId = await getDefaultStoreId();
  const where: Prisma.MemberWhereInput = { storeId };
  const s = search?.trim();
  if (s) {
    where.OR = [
      { phone: { contains: normPhone(s) } },
      { name: { contains: s, mode: 'insensitive' } },
    ];
  }
  const rows = await prisma.member.findMany({
    where,
    orderBy: { lastActivityAt: 'desc' },
    take: 200,
  });
  return rows.map(memberDto);
}

function rewardRedemptionDto(r: {
  id: string;
  type: string;
  name: string;
  value: Prisma.Decimal;
  menuItemId: string | null;
  pointsSpent: number;
  source: string;
  status: string;
  expiresAt: Date | null;
  sessionId: string | null;
  usedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: r.id,
    type: r.type,
    name: r.name,
    value: Number(r.value),
    menuItemId: r.menuItemId,
    pointsSpent: r.pointsSpent,
    source: r.source,
    status: r.status,
    expiresAt: r.expiresAt,
    sessionId: r.sessionId,
    usedAt: r.usedAt,
    createdAt: r.createdAt,
  };
}

export async function getMember(id: string) {
  const storeId = await getDefaultStoreId();
  const m = await prisma.member.findFirst({ where: { id, storeId } });
  if (!m) throw ApiError.notFound('Member not found');
  const [points, stamps, rewards] = await Promise.all([
    prisma.pointsLedger.findMany({
      where: { memberId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.stampLedger.findMany({
      where: { memberId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.rewardRedemption.findMany({
      where: { memberId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);
  return {
    ...memberDto(m),
    pointsLedger: points.map((p) => ({
      id: p.id,
      type: p.type,
      points: p.points,
      reason: p.reason,
      sessionId: p.sessionId,
      createdAt: p.createdAt,
    })),
    stampLedger: stamps.map((st) => ({
      id: st.id,
      delta: st.delta,
      reason: st.reason,
      createdAt: st.createdAt,
    })),
    rewards: rewards.map(rewardRedemptionDto),
  };
}

// Enrol a member (shared by admin create + public self-serve). Grants the
// welcome bonus + sets the starting tier inside one transaction.
export async function enrolMember(
  storeId: string,
  input: {
    phone: string;
    name?: string | null;
    birthday?: string | null;
    consentMarketing?: boolean;
  },
) {
  const phone = normPhone(input.phone);
  if (phone.replace(/\D/g, '').length < 6)
    throw ApiError.badRequest('A valid phone number is required');
  const dup = await prisma.member.findUnique({ where: { storeId_phone: { storeId, phone } } });
  if (dup) throw ApiError.conflict('A member with this phone already exists');
  const config = await loadConfig(storeId);

  const member = await prisma.$transaction(async (tx) => {
    const created = await tx.member.create({
      data: {
        storeId,
        phone,
        name: input.name?.trim() || null,
        birthday: parseBirthday(input.birthday ?? null),
        consentMarketing: input.consentMarketing ?? false,
      },
    });
    if (config.loyaltyEnabled && config.welcomeBonusPoints > 0) {
      await applyPoints(tx, {
        memberId: created.id,
        storeId,
        type: 'BONUS',
        points: config.welcomeBonusPoints,
        reason: 'Welcome bonus',
      });
    }
    const fresh = await tx.member.findUniqueOrThrow({ where: { id: created.id } });
    await recomputeTier(tx, fresh, { tierBasis: config.tierBasis, tiers: config.tiers });
    return tx.member.findUniqueOrThrow({ where: { id: created.id } });
  });
  return memberDto(member);
}

export async function createMember(input: CreateMemberInput) {
  const storeId = await getDefaultStoreId();
  return enrolMember(storeId, input);
}

export async function updateMember(id: string, input: UpdateMemberInput) {
  const storeId = await getDefaultStoreId();
  const existing = await prisma.member.findFirst({ where: { id, storeId } });
  if (!existing) throw ApiError.notFound('Member not found');
  const data: Prisma.MemberUpdateInput = {};
  if (input.name !== undefined) data.name = input.name?.trim() || null;
  if (input.birthday !== undefined) data.birthday = parseBirthday(input.birthday);
  if (input.consentMarketing !== undefined) data.consentMarketing = input.consentMarketing;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  const m = await prisma.member.update({ where: { id }, data });
  return memberDto(m);
}

// Members are never destroyed — "delete" deactivates (isActive=false), keeping
// the loyalty history intact. Reversible via updateMember({ isActive: true }).
export async function deleteMember(id: string) {
  const storeId = await getDefaultStoreId();
  const existing = await prisma.member.findFirst({ where: { id, storeId } });
  if (!existing) throw ApiError.notFound('Member not found');
  await prisma.member.update({ where: { id }, data: { isActive: false } });
  return { id, deactivated: true };
}

// Manual points adjustment (manager goodwill / correction). Signed, non-zero.
export async function adjustPoints(id: string, points: number, reason?: string) {
  const storeId = await getDefaultStoreId();
  const existing = await prisma.member.findFirst({ where: { id, storeId } });
  if (!existing) throw ApiError.notFound('Member not found');
  if (points < 0 && existing.pointsBalance + points < 0) {
    throw ApiError.badRequest('Adjustment would put the balance below zero');
  }
  const config = await loadConfig(storeId);
  const m = await prisma.$transaction(async (tx) => {
    await applyPoints(tx, {
      memberId: id,
      storeId,
      type: 'ADJUST',
      points,
      reason: reason?.trim() || 'Manual adjustment',
    });
    const fresh = await tx.member.findUniqueOrThrow({ where: { id } });
    await recomputeTier(tx, fresh, { tierBasis: config.tierBasis, tiers: config.tiers });
    return tx.member.findUniqueOrThrow({ where: { id } });
  });
  return memberDto(m);
}

/* ----------------------------- Reward catalog ----------------------------- */

function rewardDto(r: {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  type: string;
  value: Prisma.Decimal;
  menuItemId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    pointsCost: r.pointsCost,
    type: r.type,
    value: Number(r.value),
    menuItemId: r.menuItemId,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function listRewards() {
  const storeId = await getDefaultStoreId();
  const rows = await prisma.rewardCatalog.findMany({
    where: { storeId },
    orderBy: { pointsCost: 'asc' },
  });
  return rows.map(rewardDto);
}

async function ensureMenuItemInStore(menuItemId: string, storeId: string) {
  const item = await prisma.menuItem.findFirst({
    where: { id: menuItemId, storeId },
    select: { id: true },
  });
  if (!item) throw ApiError.badRequest('That menu item does not exist in this store');
}

export async function createReward(input: CreateRewardInput) {
  const storeId = await getDefaultStoreId();
  if (input.type === 'FREE_ITEM' && input.menuItemId) {
    await ensureMenuItemInStore(input.menuItemId, storeId);
  }
  const r = await prisma.rewardCatalog.create({
    data: {
      storeId,
      name: input.name,
      description: input.description?.trim() || null,
      pointsCost: input.pointsCost,
      type: input.type,
      value: input.type === 'FIXED_VOUCHER' ? (input.value ?? 0) : 0,
      menuItemId: input.type === 'FREE_ITEM' ? (input.menuItemId ?? null) : null,
      isActive: input.isActive ?? true,
    },
  });
  return rewardDto(r);
}

export async function updateReward(id: string, input: UpdateRewardInput) {
  const storeId = await getDefaultStoreId();
  const existing = await prisma.rewardCatalog.findFirst({ where: { id, storeId } });
  if (!existing) throw ApiError.notFound('Reward not found');
  if (input.menuItemId) await ensureMenuItemInStore(input.menuItemId, storeId);
  const data: Prisma.RewardCatalogUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.pointsCost !== undefined) data.pointsCost = input.pointsCost;
  if (input.type !== undefined) data.type = input.type;
  if (input.value !== undefined) data.value = input.value;
  if (input.menuItemId !== undefined) data.menuItemId = input.menuItemId;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  const r = await prisma.rewardCatalog.update({ where: { id }, data });
  return rewardDto(r);
}

// Rewards are never destroyed — "delete" deactivates (isActive=false), keeping
// any redemption history. Reversible via updateReward({ isActive: true }).
export async function deleteReward(id: string) {
  const storeId = await getDefaultStoreId();
  const existing = await prisma.rewardCatalog.findFirst({ where: { id, storeId } });
  if (!existing) throw ApiError.notFound('Reward not found');
  await prisma.rewardCatalog.update({ where: { id }, data: { isActive: false } });
  return { id, deactivated: true };
}
