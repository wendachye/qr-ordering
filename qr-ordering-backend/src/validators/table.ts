import { z } from 'zod';

// Table codes are server-minted (globally unique, used in the QR URL), so the
// client only supplies a human-facing name and active flag.
export const createTableSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  isActive: z.boolean().default(true),
});

export const updateTableSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    isActive: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
