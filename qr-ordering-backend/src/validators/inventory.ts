import { z } from 'zod';

// A manual stock move from the inventory screen: restock (+) or waste (−).
export const adjustStockSchema = z.object({
  delta: z.coerce
    .number()
    .int()
    .refine((n) => n !== 0, 'Enter a non-zero amount'),
  reason: z.enum(['restock', 'waste']).default('restock'),
  note: z.string().trim().max(300).nullable().optional(),
});

// Turn tracking on/off and/or set the absolute count + low-stock threshold.
export const stockConfigSchema = z
  .object({
    trackStock: z.boolean().optional(),
    stockQty: z.coerce.number().int().min(0).max(1_000_000).optional(),
    lowStockThreshold: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type StockConfigInput = z.infer<typeof stockConfigSchema>;
