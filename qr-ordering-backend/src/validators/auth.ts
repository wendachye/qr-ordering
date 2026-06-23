import { z } from 'zod';

// Normalize email centrally (trim + lowercase) so register and login always
// resolve to the same stored identity.
const email = z.string().trim().toLowerCase().email('A valid email is required');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Tenant provisioning input for registerStore. There is no public signup route
// (the super-admin creates tenants); this contract backs the seed + test factory.
export const registerSchema = z.object({
  restaurantName: z.string().trim().min(2, 'Restaurant name is required').max(80),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  ownerName: z.string().trim().min(1).max(80).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// Re-confirm the signed-in admin's password (e.g. to authorise a price override).
export const passwordVerifySchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export type PasswordVerifyInput = z.infer<typeof passwordVerifySchema>;
