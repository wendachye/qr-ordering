import { z } from 'zod';

const phone = z.string().trim().min(6, 'A valid phone number is required').max(24);
const birthday = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .nullable();
const rewardType = z.enum(['FREE_ITEM', 'FIXED_VOUCHER']);

// --- Members (admin) ---

export const createMemberSchema = z.object({
  phone,
  name: z.string().trim().max(100).nullable().optional(),
  birthday: birthday.optional(),
  consentMarketing: z.boolean().optional(),
});

export const updateMemberSchema = z
  .object({
    name: z.string().trim().max(100).nullable(),
    birthday,
    consentMarketing: z.boolean(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

// A manual points adjustment (manager goodwill / correction). Signed, non-zero.
export const adjustPointsSchema = z
  .object({
    points: z.coerce.number().int().min(-10000000).max(10000000),
    reason: z.string().trim().max(200).optional(),
  })
  .refine((d) => d.points !== 0, { message: 'Points must be non-zero', path: ['points'] });

// --- Reward catalog (admin) ---

export const createRewardSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    description: z.string().trim().max(200).nullable().optional(),
    pointsCost: z.coerce.number().int().min(1).max(10000000),
    type: rewardType,
    value: z.coerce.number().min(0).max(100000).optional(),
    menuItemId: z.string().min(1).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => d.type !== 'FIXED_VOUCHER' || (d.value ?? 0) > 0, {
    message: 'A fixed-voucher reward needs a value',
    path: ['value'],
  })
  .refine((d) => d.type !== 'FREE_ITEM' || !!d.menuItemId, {
    message: 'A free-item reward needs a menu item',
    path: ['menuItemId'],
  });

export const updateRewardSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(200).nullable(),
    pointsCost: z.coerce.number().int().min(1).max(10000000),
    type: rewardType,
    value: z.coerce.number().min(0).max(100000),
    menuItemId: z.string().min(1).nullable(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

// --- Program config (admin) ---

const tierDefSchema = z.object({
  tier: z.string().trim().min(1).max(40),
  threshold: z.coerce.number().int().min(0).max(100000000),
  earnMultiplier: z.coerce.number().min(0.1).max(100),
});

export const loyaltyConfigSchema = z
  .object({
    loyaltyEnabled: z.boolean(),
    pointsEnabled: z.boolean(),
    stampsEnabled: z.boolean(),
    earnRatePoints: z.coerce.number().min(0).max(10000),
    redeemRatePoints: z.coerce.number().int().min(1).max(1000000),
    minRedeemPoints: z.coerce.number().int().min(0).max(10000000),
    maxRedeemPercent: z.coerce.number().min(0).max(100),
    pointsExpiryMonths: z.coerce.number().int().min(1).max(120).nullable(),
    welcomeBonusPoints: z.coerce.number().int().min(0).max(10000000),
    birthdayBonusPoints: z.coerce.number().int().min(0).max(10000000),
    stampThreshold: z.coerce.number().int().min(1).max(1000),
    stampMinSpend: z.coerce.number().min(0).max(100000),
    stampRewardType: rewardType.nullable(),
    stampRewardValue: z.coerce.number().min(0).max(100000),
    stampRewardItemId: z.string().min(1).nullable(),
    tierThresholds: z.array(tierDefSchema).max(10),
    tierBasis: z.enum(['LIFETIME_POINTS', 'LIFETIME_SPEND']),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

// --- Staff: attach a member to a tab by phone (create on first sight) ---

export const attachMemberSchema = z.object({
  phone,
  name: z.string().trim().max(100).optional(),
});

// Staff: redeem a member's points as a bill discount on the attached tab.
export const redeemPointsSchema = z.object({
  points: z.coerce.number().int().min(1).max(10000000),
});

export type AttachMemberInput = z.infer<typeof attachMemberSchema>;
export type RedeemPointsInput = z.infer<typeof redeemPointsSchema>;
export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type CreateRewardInput = z.infer<typeof createRewardSchema>;
export type UpdateRewardInput = z.infer<typeof updateRewardSchema>;
export type LoyaltyConfigInput = z.infer<typeof loyaltyConfigSchema>;
