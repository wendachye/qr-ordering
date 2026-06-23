import { z } from 'zod';

const roleSchema = z.enum(['OWNER', 'MANAGER', 'CASHIER', 'WAITER']);

export const createStaffSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required').max(120),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  name: z.string().trim().max(80).optional(),
  role: roleSchema,
});

export const updateStaffSchema = z
  .object({
    name: z.string().trim().max(80).nullable().optional(),
    role: roleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
