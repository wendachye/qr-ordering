import { z } from 'zod';

// Store-level settings editable from the admin Settings module.
export const settingsUpdateSchema = z.object({
  storeName: z.string().trim().min(1, 'Name is required').max(80).optional(),
  // Restaurant logo URL ('' / null clears it).
  logoUrl: z.string().trim().max(1000).nullable().optional(),
  // Brand accent colour for the customer app, a hex string ('' / null clears it).
  themeColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #059669')
    .or(z.literal(''))
    .nullable()
    .optional(),
  featuredTitle: z.string().trim().min(1).max(40).optional(),
  takeawayCharge: z.coerce.number().min(0).max(10000).optional(),
  // Service charge as a percentage (0–100). 0 = not applied.
  serviceChargeRate: z.coerce.number().min(0).max(100).optional(),
  // Named taxes (e.g. SST / GST), each a % applied on (subtotal + service charge).
  taxes: z
    .array(
      z.object({
        name: z.string().trim().min(1, 'Tax name is required').max(20),
        rate: z.coerce.number().min(0).max(100),
      }),
    )
    .max(8)
    .optional(),
  voidPinRequired: z.boolean().optional(),
  discountPinRequired: z.boolean().optional(),
  overridePinRequired: z.boolean().optional(),
  paymentMethods: z
    .array(z.string().trim().min(1).max(40))
    .min(1, 'Keep at least one payment method')
    .max(20)
    .optional(),
});

export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;

// Set/change the override PIN — gated by the admin's password.
export const setPinSchema = z.object({
  currentPassword: z.string().min(1, 'Admin password is required'),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4–6 digits'),
});

export type SetPinInput = z.infer<typeof setPinSchema>;

// Verify the override PIN (authorises a price override).
export const verifyPinSchema = z.object({
  pin: z.string().min(1, 'PIN is required'),
});

export type VerifyPinInput = z.infer<typeof verifyPinSchema>;
