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
    // Gratuity added on top of the bill (kept separate from sales).
    tip: z.coerce.number().min(0).max(100000).optional(),
  })
  .superRefine(refineDiscount);

export type CloseSessionInput = z.infer<typeof closeSessionSchema>;

// Record a tender against a tab — full or partial. `amount` omitted settles the
// whole remaining balance; a smaller amount is a split / partial payment (the tab
// stays open with a balance). `tendered` is cash given (for change); discount /
// voucher only apply on the first tender (locked thereafter).
export const payTabSchema = z
  .object({
    paymentMethod: z.string().trim().min(1, 'Select a payment method').max(40),
    amount: z.coerce.number().positive().max(1_000_000).optional(),
    tip: z.coerce.number().min(0).max(100000).optional(),
    tendered: z.coerce.number().min(0).max(1_000_000).optional(),
    reference: z.string().trim().max(120).optional(),
    discountType: discountTypeSchema.optional(),
    discountValue: z.coerce.number().min(0).max(100000).optional(),
    voucherCode: z.string().trim().max(40).optional(),
  })
  .superRefine(refineDiscount);

export type PayTabInput = z.infer<typeof payTabSchema>;

// Move an open tab to another (free) table.
export const moveSessionSchema = z.object({
  targetTableId: z.string().min(1, 'Pick a table'),
});

// Combine another open tab into this one.
export const combineSessionSchema = z.object({
  sourceSessionId: z.string().min(1, 'Pick a tab to combine'),
});
