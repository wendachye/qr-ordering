import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  isActive: z.boolean().default(true),
});

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    sortOrder: z.coerce.number().int(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'No fields to update' });

// A configurable option group on a menu item (e.g. "Size", "Spice level",
// "Add-ons"). Each choice carries a price delta added to the item price when
// selected. minSelect/maxSelect drive the required + single/multiple behaviour.
export const optionChoiceSchema = z.object({
  name: z.string().trim().min(1, 'Choice name is required').max(100),
  priceDelta: z.coerce.number().min(0).max(100000).default(0),
});

export const optionGroupSchema = z
  .object({
    name: z.string().trim().min(1, 'Group name is required').max(100),
    required: z.boolean().default(true),
    minSelect: z.coerce.number().int().min(0).max(20).default(1),
    maxSelect: z.coerce.number().int().min(1).max(20).default(1),
    choices: z.array(optionChoiceSchema).min(1, 'Add at least one choice').max(40),
  })
  .superRefine((g, ctx) => {
    if (g.minSelect > g.maxSelect) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Minimum cannot exceed maximum',
        path: ['minSelect'],
      });
    }
    if (g.required && g.minSelect < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A required group must allow at least one choice',
        path: ['minSelect'],
      });
    }
  });

export const createItemSchema = z
  .object({
    categoryId: z.string().min(1, 'categoryId is required'),
    name: z.string().trim().min(1, 'Name is required').max(150),
    description: z.string().trim().max(500).optional().nullable(),
    price: z.coerce.number().min(0, 'Price must be >= 0'),
    // Standing menu discount (shown on the customer menu + charged on order).
    discountType: z.enum(['PERCENT', 'FIXED']).nullable().optional(),
    discountValue: z.coerce.number().min(0).max(100000).optional(),
    isAvailable: z.boolean().default(true),
    // POS-only ("secret") item: hidden from the customer menu, orderable in POS.
    posOnly: z.boolean().default(false),
    imageUrls: z.array(z.string().trim().min(1).max(1000)).max(8).optional(),
    tags: z.array(z.string().trim().min(1).max(24)).max(8).optional(),
    optionGroups: z.array(optionGroupSchema).max(20).optional(),
  })
  .refine((d) => !d.discountType || (d.discountValue ?? 0) > 0, {
    message: 'Discount value is required',
    path: ['discountValue'],
  })
  .refine((d) => d.discountType !== 'PERCENT' || (d.discountValue ?? 0) <= 100, {
    message: 'Percentage must be 0–100',
    path: ['discountValue'],
  });

export const updateItemSchema = z
  .object({
    categoryId: z.string().min(1),
    name: z.string().trim().min(1).max(150),
    description: z.string().trim().max(500).nullable(),
    price: z.coerce.number().min(0),
    discountType: z.enum(['PERCENT', 'FIXED']).nullable(),
    discountValue: z.coerce.number().min(0).max(100000),
    isAvailable: z.boolean(),
    posOnly: z.boolean(),
    sortOrder: z.coerce.number().int(),
    imageUrls: z.array(z.string().trim().min(1).max(1000)).max(8),
    tags: z.array(z.string().trim().min(1).max(24)).max(8),
    optionGroups: z.array(optionGroupSchema).max(20),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'No fields to update' });

export const soldOutSchema = z.object({
  isAvailable: z.boolean(),
});

// Bulk reorder: ids in the desired display order (categories store-wide, or
// items within one category). sortOrder is reassigned to the array index.
export const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'At least one id is required'),
});

// Move an item to a different category (appends to the end of that category).
export const moveItemSchema = z.object({
  categoryId: z.string().min(1, 'categoryId is required'),
});

// Toggle an item's "featured" flag (the Popular/Chef's-picks strip).
export const featureSchema = z.object({
  isFeatured: z.boolean(),
});

// Store-level menu settings: the featured section title + takeaway charge.
// Both optional — a PATCH updates whatever fields are present.
export const menuSettingsSchema = z.object({
  featuredTitle: z.string().trim().min(1, 'Title is required').max(40).optional(),
  featuredEnabled: z.boolean().optional(),
  takeawayCharge: z.coerce.number().min(0).max(10000).optional(),
  // Customer-menu hero banner. An empty image list / blank title/subtitle are
  // treated as "use default"; multiple images rotate as a hero slideshow.
  bannerImageUrls: z.array(z.string().trim().min(1).max(1000)).max(8).optional(),
  bannerTitle: z.string().trim().max(60).nullable().optional(),
  bannerSubtitle: z.string().trim().max(160).nullable().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ReorderInput = z.infer<typeof reorderSchema>;
