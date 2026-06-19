import { z } from 'zod';

import { discountTypeSchema, refineDiscount } from './order';

export const sessionListQuerySchema = z.object({
  status: z.enum(['OPEN', 'CLOSED', 'CANCELLED']).optional(),
  tableId: z.string().min(1).optional(),
});

export type SessionListQuery = z.infer<typeof sessionListQuerySchema>;

// Number of guests (pax / covers) seated on a tab.
export const sessionPaxSchema = z.object({
  pax: z.number().int().min(1).max(999),
});

export type SessionPaxInput = z.infer<typeof sessionPaxSchema>;

// Settling a tab records the payment method and an optional bill-level discount.
export const closeSessionSchema = z
  .object({
    paymentMethod: z.string().trim().min(1, 'Select a payment method').max(40),
    discountType: discountTypeSchema.optional(),
    discountValue: z.coerce.number().min(0).max(100000).optional(),
    // A staff-applied voucher code ('' clears any customer-attached voucher).
    voucherCode: z.string().trim().max(40).optional(),
  })
  .superRefine(refineDiscount);

export type CloseSessionInput = z.infer<typeof closeSessionSchema>;

// Move an open tab to another (free) table.
export const moveSessionSchema = z.object({
  targetTableId: z.string().min(1, 'Pick a table'),
});

// Combine another open tab into this one.
export const combineSessionSchema = z.object({
  sourceSessionId: z.string().min(1, 'Pick a tab to combine'),
});
