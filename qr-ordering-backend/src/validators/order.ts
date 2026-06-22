import { z } from 'zod';

// A manual discount is "percent off" or "fixed RM off". Both fields must be
// present together; a percent can't exceed 100. Reused for line + bill discounts.
export const discountTypeSchema = z.enum(['PERCENT', 'FIXED']);

export function refineDiscount(
  v: { discountType?: 'PERCENT' | 'FIXED'; discountValue?: number },
  ctx: z.RefinementCtx,
) {
  const hasType = v.discountType != null;
  const hasValue = v.discountValue != null;
  if (hasType !== hasValue) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'discountType and discountValue must be provided together',
      path: [hasType ? 'discountValue' : 'discountType'],
    });
    return;
  }
  if (v.discountType === 'PERCENT' && v.discountValue != null && v.discountValue > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A percentage discount cannot exceed 100',
      path: ['discountValue'],
    });
  }
}

// One pick within a combo line: a group + the chosen option.
const comboSelectionSchema = z.object({
  groupId: z.string().min(1),
  optionId: z.string().min(1),
});

export const createOrderSchema = z.object({
  tableCode: z.string().min(1, 'tableCode is required'),
  note: z.string().trim().max(500).optional(),
  items: z
    .array(
      z
        .object({
          // Either a menu item OR a combo (one pick per group).
          menuItemId: z.string().min(1).optional(),
          comboId: z.string().min(1).optional(),
          comboSelections: z.array(comboSelectionSchema).max(20).optional(),
          quantity: z.coerce.number().int().min(1, 'quantity must be at least 1').max(99),
          note: z.string().trim().max(255).optional(),
          optionChoiceIds: z.array(z.string().min(1)).max(20).optional(),
        })
        .superRefine((v, ctx) => {
          if (!!v.menuItemId === !!v.comboId) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Provide either a menu item or a combo',
              path: ['menuItemId'],
            });
          }
        }),
    )
    .min(1, 'At least one item is required'),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// Staff order entry (admin-authenticated): in addition to the customer fields,
// a line may carry a manual price override and a takeaway flag (+ whether to
// apply the packaging charge). These are ONLY honoured on the admin route.
export const createAdminOrderSchema = z.object({
  tableCode: z.string().min(1, 'tableCode is required'),
  note: z.string().trim().max(500).optional(),
  items: z
    .array(
      z
        .object({
          // A menu item, a custom (open) line with name + price, or a combo.
          menuItemId: z.string().min(1).optional(),
          customName: z.string().trim().min(1).max(120).optional(),
          customPrice: z.coerce.number().min(0).max(100000).optional(),
          comboId: z.string().min(1).optional(),
          comboSelections: z.array(comboSelectionSchema).max(20).optional(),
          quantity: z.coerce.number().int().min(1).max(99),
          note: z.string().trim().max(255).optional(),
          optionChoiceIds: z.array(z.string().min(1)).max(20).optional(),
          // Ad-hoc custom add-ons / special requests (e.g. "add 2 eggs" +RM2).
          // Each adds to the line's unit price and prints on the ticket.
          addons: z
            .array(
              z.object({
                name: z.string().trim().min(1).max(120),
                price: z.coerce.number().min(0).max(100000),
              }),
            )
            .max(20)
            .optional(),
          priceOverride: z.coerce.number().min(0).max(100000).optional(),
          isTakeaway: z.boolean().optional(),
          applyTakeawayCharge: z.boolean().optional(),
          // Manual line discount (percent or fixed RM off the line).
          discountType: discountTypeSchema.optional(),
          discountValue: z.coerce.number().min(0).max(100000).optional(),
        })
        .superRefine(refineDiscount)
        .superRefine((v, ctx) => {
          const kinds = [!!v.menuItemId, !!v.customName, !!v.comboId].filter(Boolean).length;
          if (kinds !== 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Provide exactly one of: a menu item, a custom item, or a combo',
              path: ['menuItemId'],
            });
          } else if (!!v.customName && v.customPrice == null) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'A custom item needs a price',
              path: ['customPrice'],
            });
          }
        }),
    )
    .min(1, 'At least one item is required'),
});

export type CreateAdminOrderInput = z.infer<typeof createAdminOrderSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.enum(['NEW', 'COMPLETED', 'CANCELLED']),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

// Void a single item on an open tab. Reason is optional; pin only needed when
// the store requires it.
export const voidItemSchema = z.object({
  reason: z.string().trim().max(120).optional(),
  pin: z.string().max(12).optional(),
});

export type VoidItemInput = z.infer<typeof voidItemSchema>;
