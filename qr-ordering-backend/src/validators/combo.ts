import { z } from 'zod';

// One option within a combo group — maps to a menu item, with an optional
// upcharge for a premium pick.
const comboOptionSchema = z.object({
  menuItemId: z.string().min(1, 'Pick a menu item'),
  priceDelta: z.coerce.number().min(0).max(100000).default(0),
});

// A combo group — the diner picks exactly one option from each.
const comboGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(100),
  options: z.array(comboOptionSchema).min(1, 'Add at least one option').max(40),
});

export const createComboSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  description: z.string().trim().max(500).nullable().optional(),
  price: z.coerce.number().min(0, 'Price must be >= 0').max(100000),
  imageUrls: z.array(z.string().trim().min(1).max(1000)).max(8).optional(),
  isAvailable: z.boolean().default(true),
  posOnly: z.boolean().default(false),
  groups: z.array(comboGroupSchema).min(1, 'Add at least one group').max(10),
});

export const updateComboSchema = createComboSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

export type CreateComboInput = z.infer<typeof createComboSchema>;
export type UpdateComboInput = z.infer<typeof updateComboSchema>;
