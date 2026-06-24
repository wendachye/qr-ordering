import { z } from 'zod';

const featureKey = z.enum(['loyalty', 'vouchers', 'reports_advanced', 'tax_multi']);

// Edit a global plan definition (platform super-admin only). All optional — a
// PATCH updates whatever is present. null limits = unlimited.
export const updatePlanSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    description: z.string().trim().max(300).nullable(),
    monthlyPrice: z.coerce.number().min(0).max(100000),
    currency: z.string().trim().min(1).max(8),
    stripePriceId: z.string().trim().min(1).max(120).nullable(),
    features: z.array(featureKey).max(20),
    maxTables: z.coerce.number().int().min(0).max(100000).nullable(),
    maxMenuItems: z.coerce.number().int().min(0).max(1000000).nullable(),
    sortOrder: z.coerce.number().int().min(0).max(100),
    isActive: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

// --- Clients + outlets (platform super-admin) ---

const planKey = z.enum(['basic', 'pro']);
const subscriptionStatus = z.enum(['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED']);
const adminEmail = z.string().trim().email().max(200);
const adminPassword = z.string().min(8, 'At least 8 characters').max(100);

export const createClientSchema = z
  .object({
    clientName: z.string().trim().min(1, 'Client name is required').max(120),
    contactEmail: z.string().trim().max(200).nullable().optional(),
    contactPhone: z.string().trim().max(40).nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    outletName: z.string().trim().min(1, 'Outlet name is required').max(120),
    adminEmail: adminEmail.optional(),
    adminPassword: adminPassword.optional(),
    planKey: planKey.default('basic'),
    trialDays: z.coerce.number().int().min(0).max(365).optional(),
  })
  .refine((d) => !d.adminEmail || !!d.adminPassword, {
    message: 'A temporary password is required for the owner login',
    path: ['adminPassword'],
  });

export const updateClientSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    contactEmail: z.string().trim().max(200).nullable(),
    contactPhone: z.string().trim().max(40).nullable(),
    notes: z.string().trim().max(1000).nullable(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

export const addOutletSchema = z
  .object({
    outletName: z.string().trim().min(1, 'Outlet name is required').max(120),
    adminEmail: adminEmail.optional(),
    adminPassword: adminPassword.optional(),
    planKey: planKey.default('basic'),
    trialDays: z.coerce.number().int().min(0).max(365).optional(),
    // Join an existing brand catalogue (share its menu) instead of creating a new
    // one. Must be one of the client's own catalogues; omit for a fresh menu.
    catalogueId: z.string().min(1).optional(),
  })
  .refine((d) => !d.adminEmail || !!d.adminPassword, {
    message: 'A temporary password is required for the owner login',
    path: ['adminPassword'],
  });

export const updateOutletSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    plan: planKey,
    subscriptionStatus,
    trialEndsAt: z.string().datetime().nullable(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

export const applyPlanSchema = z.object({
  planKey,
  subscriptionStatus: subscriptionStatus.optional(),
  trialDays: z.coerce.number().int().min(0).max(365).optional(),
});

// Operator audit log list filters (all optional).
export const auditQuerySchema = z.object({
  action: z.string().trim().max(60).optional(),
  entity: z.string().trim().max(40).optional(),
  actorId: z.string().trim().max(60).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type AddOutletInput = z.infer<typeof addOutletSchema>;
export type UpdateOutletInput = z.infer<typeof updateOutletSchema>;
export type ApplyPlanInput = z.infer<typeof applyPlanSchema>;
export type AuditQuery = z.infer<typeof auditQuerySchema>;
