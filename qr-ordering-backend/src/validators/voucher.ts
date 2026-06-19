import { z } from 'zod';

const discountType = z.enum(['PERCENT', 'FIXED']);

// Create a discount voucher. PERCENT value is 0–100; FIXED is an RM amount.
export const createVoucherSchema = z
  .object({
    code: z.string().trim().min(2, 'Code is required').max(40),
    description: z.string().trim().max(120).nullable().optional(),
    discountType,
    discountValue: z.coerce.number().min(0).max(100000),
    minSpend: z.coerce.number().min(0).max(100000).optional(),
    maxRedemptions: z.coerce.number().int().min(1).max(1000000).nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => d.discountValue > 0, {
    message: 'Discount value is required',
    path: ['discountValue'],
  })
  .refine((d) => d.discountType !== 'PERCENT' || d.discountValue <= 100, {
    message: 'Percentage must be 0–100',
    path: ['discountValue'],
  });

export const updateVoucherSchema = z
  .object({
    code: z.string().trim().min(2).max(40),
    description: z.string().trim().max(120).nullable(),
    discountType,
    discountValue: z.coerce.number().min(0).max(100000),
    minSpend: z.coerce.number().min(0).max(100000),
    maxRedemptions: z.coerce.number().int().min(1).max(1000000).nullable(),
    expiresAt: z.string().datetime().nullable(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

// Public: a customer applies a voucher code to their table's open tab.
export const applyVoucherSchema = z.object({
  tableCode: z.string().trim().min(1),
  code: z.string().trim().min(2).max(40),
});

export type CreateVoucherInput = z.infer<typeof createVoucherSchema>;
export type UpdateVoucherInput = z.infer<typeof updateVoucherSchema>;
