import { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/response';
import { getDefaultStoreId } from '../../lib/store';
import { salePriceOf } from '../../lib/pricing';
import { limitReachedError, resolveEntitlementsForStore } from '../../lib/entitlements';
import type {
  CreateCategoryInput,
  CreateItemInput,
  UpdateCategoryInput,
  UpdateItemInput,
} from '../../validators/menu';

/* ----------------------------- Categories ----------------------------- */

export async function listCategories() {
  const storeId = await getDefaultStoreId();
  const categories = await prisma.menuCategory.findMany({
    where: { storeId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { items: true } } },
  });
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    itemCount: c._count.items,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}

export async function createCategory(input: CreateCategoryInput) {
  const storeId = await getDefaultStoreId();
  // Append to the end — display order is managed by drag-and-drop, not a field.
  const agg = await prisma.menuCategory.aggregate({
    where: { storeId },
    _max: { sortOrder: true },
  });
  const category = await prisma.menuCategory.create({
    data: {
      storeId,
      name: input.name,
      sortOrder: (agg._max.sortOrder ?? -1) + 1,
      isActive: input.isActive,
    },
  });
  return category;
}

export async function updateCategory(id: string, input: UpdateCategoryInput) {
  const storeId = await getDefaultStoreId();
  await ensureCategoryExists(id, storeId);
  return prisma.menuCategory.update({ where: { id }, data: input });
}

export async function deleteCategory(id: string) {
  const storeId = await getDefaultStoreId();
  await ensureCategoryExists(id, storeId);
  const itemCount = await prisma.menuItem.count({ where: { categoryId: id } });
  if (itemCount > 0) {
    throw ApiError.conflict(
      'This category still has items. Move or delete them before deleting the category.',
    );
  }
  await prisma.menuCategory.delete({ where: { id } });
  return { id };
}

async function ensureCategoryExists(id: string, storeId: string) {
  const category = await prisma.menuCategory.findFirst({ where: { id, storeId } });
  if (!category) throw ApiError.notFound('Category not found');
  return category;
}

/**
 * Reassign category sortOrder to match the given id order (0..n-1), atomically.
 * Returns the refreshed list so the client can write it straight to cache.
 */
export async function reorderCategories(ids: string[]) {
  const storeId = await getDefaultStoreId();
  const found = await prisma.menuCategory.findMany({
    where: { id: { in: ids }, storeId },
    select: { id: true },
  });
  if (found.length !== ids.length) {
    throw ApiError.badRequest('One or more categories were not found in this store');
  }
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.menuCategory.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  return listCategories();
}

/* -------------------------------- Items -------------------------------- */

// Shared include so every item read returns its category name + configured
// option groups/choices (ordered) — the admin form edits these in place.
const itemInclude = {
  category: { select: { name: true } },
  optionGroups: {
    orderBy: { sortOrder: 'asc' },
    include: { choices: { orderBy: { sortOrder: 'asc' } } },
  },
} satisfies Prisma.MenuItemInclude;

function toItemDto(item: {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  imageUrls: string[];
  tags: string[];
  price: unknown;
  discountType: string | null;
  discountValue: unknown;
  isAvailable: boolean;
  posOnly: boolean;
  availableDays: number[];
  availableFrom: string | null;
  availableTo: string | null;
  sortOrder: number;
  isFeatured: boolean;
  featuredOrder: number;
  createdAt: Date;
  updatedAt: Date;
  category?: { name: string } | null;
  optionGroups?: {
    id: string;
    name: string;
    required: boolean;
    minSelect: number;
    maxSelect: number;
    choices: { id: string; name: string; priceDelta: unknown }[];
  }[];
}) {
  return {
    id: item.id,
    categoryId: item.categoryId,
    categoryName: item.category?.name ?? null,
    name: item.name,
    description: item.description,
    imageUrls: item.imageUrls,
    tags: item.tags,
    price: Number(item.price),
    discountType: item.discountType,
    discountValue: Number(item.discountValue ?? 0),
    salePrice: salePriceOf(Number(item.price), item.discountType, Number(item.discountValue ?? 0)),
    isAvailable: item.isAvailable,
    posOnly: item.posOnly,
    availableDays: item.availableDays,
    availableFrom: item.availableFrom,
    availableTo: item.availableTo,
    sortOrder: item.sortOrder,
    isFeatured: item.isFeatured,
    featuredOrder: item.featuredOrder,
    optionGroups: (item.optionGroups ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      required: g.required,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      choices: g.choices.map((c) => ({
        id: c.id,
        name: c.name,
        priceDelta: Number(c.priceDelta),
      })),
    })),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

// Map validated option-group input → Prisma nested-create payload (sortOrder by
// array index so display order follows the form).
function optionGroupsCreate(
  groups: {
    name: string;
    required: boolean;
    minSelect: number;
    maxSelect: number;
    choices: { name: string; priceDelta: number }[];
  }[],
) {
  return {
    create: groups.map((g, gi) => ({
      name: g.name,
      required: g.required,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      sortOrder: gi,
      choices: {
        create: g.choices.map((c, ci) => ({
          name: c.name,
          priceDelta: c.priceDelta,
          sortOrder: ci,
        })),
      },
    })),
  };
}

export async function listItems(categoryId?: string) {
  const storeId = await getDefaultStoreId();
  const items = await prisma.menuItem.findMany({
    where: { storeId, ...(categoryId ? { categoryId } : {}) },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: itemInclude,
  });
  return items.map(toItemDto);
}

export async function createItem(input: CreateItemInput) {
  const storeId = await getDefaultStoreId();
  await ensureCategoryInStore(input.categoryId, storeId);

  // Enforce the plan's menu-item cap (null = unlimited).
  const ent = await resolveEntitlementsForStore(storeId);
  if (ent.limits.maxMenuItems != null) {
    const count = await prisma.menuItem.count({ where: { storeId } });
    if (count >= ent.limits.maxMenuItems)
      throw limitReachedError('menuItems', ent.limits.maxMenuItems);
  }

  // Append to the end of its category (drag-and-drop manages order thereafter).
  const agg = await prisma.menuItem.aggregate({
    where: { storeId, categoryId: input.categoryId },
    _max: { sortOrder: true },
  });

  const item = await prisma.menuItem.create({
    data: {
      storeId,
      categoryId: input.categoryId,
      name: input.name,
      description: input.description ?? null,
      imageUrls: input.imageUrls ?? [],
      tags: input.tags ?? [],
      price: input.price,
      discountType: input.discountType ?? null,
      discountValue: input.discountType ? (input.discountValue ?? 0) : 0,
      isAvailable: input.isAvailable,
      posOnly: input.posOnly,
      availableDays: input.availableDays ?? [],
      availableFrom: input.availableFrom ?? null,
      availableTo: input.availableTo ?? null,
      sortOrder: (agg._max.sortOrder ?? -1) + 1,
      ...(input.optionGroups?.length
        ? { optionGroups: optionGroupsCreate(input.optionGroups) }
        : {}),
    },
    include: itemInclude,
  });
  return toItemDto(item);
}

export async function updateItem(id: string, input: UpdateItemInput) {
  const storeId = await getDefaultStoreId();
  const existing = await prisma.menuItem.findUnique({ where: { id } });
  if (!existing || existing.storeId !== storeId) throw ApiError.notFound('Menu item not found');

  if (input.categoryId) {
    await ensureCategoryInStore(input.categoryId, storeId);
  }

  // When optionGroups are supplied we full-replace them: drop the existing
  // groups (cascade removes their choices) and recreate from the input, all in
  // one transaction. Historical orders are unaffected — each OrderItem stores a
  // denormalised JSON snapshot of its options, not a foreign key to a choice.
  const item = await prisma.$transaction(async (tx) => {
    if (input.optionGroups !== undefined) {
      await tx.optionGroup.deleteMany({ where: { menuItemId: id } });
    }
    return tx.menuItem.update({
      where: { id },
      data: {
        categoryId: input.categoryId,
        name: input.name,
        description: input.description,
        imageUrls: input.imageUrls,
        tags: input.tags,
        price: input.price,
        discountType: input.discountType,
        discountValue: input.discountValue,
        isAvailable: input.isAvailable,
        posOnly: input.posOnly,
        availableDays: input.availableDays,
        availableFrom: input.availableFrom,
        availableTo: input.availableTo,
        sortOrder: input.sortOrder,
        ...(input.optionGroups && input.optionGroups.length
          ? { optionGroups: optionGroupsCreate(input.optionGroups) }
          : {}),
      },
      include: itemInclude,
    });
  });
  return toItemDto(item);
}

export async function deleteItem(id: string) {
  const storeId = await getDefaultStoreId();
  const existing = await prisma.menuItem.findUnique({ where: { id } });
  if (!existing || existing.storeId !== storeId) throw ApiError.notFound('Menu item not found');

  const orderedCount = await prisma.orderItem.count({ where: { menuItemId: id } });
  if (orderedCount > 0) {
    throw ApiError.conflict(
      'This item appears on existing orders. Mark it sold out instead of deleting it.',
    );
  }
  await prisma.menuItem.delete({ where: { id } });
  return { id };
}

export async function setItemAvailability(id: string, isAvailable: boolean) {
  const storeId = await getDefaultStoreId();
  const existing = await prisma.menuItem.findUnique({ where: { id } });
  if (!existing || existing.storeId !== storeId) throw ApiError.notFound('Menu item not found');

  const item = await prisma.menuItem.update({
    where: { id },
    data: { isAvailable },
    include: itemInclude,
  });
  return toItemDto(item);
}

/**
 * Reassign item sortOrder within a single category to match the given id order
 * (0..n-1). All ids must belong to one category in this store.
 */
export async function reorderItems(ids: string[]) {
  const storeId = await getDefaultStoreId();
  const found = await prisma.menuItem.findMany({
    where: { id: { in: ids }, storeId },
    select: { id: true, categoryId: true },
  });
  if (found.length !== ids.length) {
    throw ApiError.badRequest('One or more items were not found in this store');
  }
  if (new Set(found.map((i) => i.categoryId)).size > 1) {
    throw ApiError.badRequest('Items in a reorder must all belong to the same category');
  }
  await prisma.$transaction(
    ids.map((id, index) => prisma.menuItem.update({ where: { id }, data: { sortOrder: index } })),
  );
  return listItems();
}

/**
 * Move an item to a different category, appending it to the end of that
 * category. Returns the full item list so the client can refresh its cache.
 */
export async function moveItem(id: string, categoryId: string) {
  const storeId = await getDefaultStoreId();
  const existing = await prisma.menuItem.findUnique({ where: { id } });
  if (!existing || existing.storeId !== storeId) throw ApiError.notFound('Menu item not found');
  await ensureCategoryInStore(categoryId, storeId);

  if (existing.categoryId !== categoryId) {
    const agg = await prisma.menuItem.aggregate({
      where: { storeId, categoryId },
      _max: { sortOrder: true },
    });
    await prisma.menuItem.update({
      where: { id },
      data: { categoryId, sortOrder: (agg._max.sortOrder ?? -1) + 1 },
    });
  }
  return listItems();
}

async function ensureCategoryInStore(categoryId: string, storeId: string) {
  const category = await prisma.menuCategory.findUnique({ where: { id: categoryId } });
  if (!category || category.storeId !== storeId) {
    throw ApiError.badRequest('Category does not exist in this store');
  }
  return category;
}

/* ------------------------- Featured strip + settings ------------------------- */

/**
 * Toggle an item's featured flag. Turning it ON appends it to the end of the
 * featured strip (featuredOrder = max+1). Returns the full item list.
 */
export async function setItemFeatured(id: string, isFeatured: boolean) {
  const storeId = await getDefaultStoreId();
  const existing = await prisma.menuItem.findUnique({ where: { id } });
  if (!existing || existing.storeId !== storeId) throw ApiError.notFound('Menu item not found');

  let featuredOrder = existing.featuredOrder;
  if (isFeatured && !existing.isFeatured) {
    const agg = await prisma.menuItem.aggregate({
      where: { storeId, isFeatured: true },
      _max: { featuredOrder: true },
    });
    featuredOrder = (agg._max.featuredOrder ?? -1) + 1;
  }

  await prisma.menuItem.update({ where: { id }, data: { isFeatured, featuredOrder } });
  return listItems();
}

/** Reassign featuredOrder to match the given id order (0..n-1). Spans categories. */
export async function reorderFeatured(ids: string[]) {
  const storeId = await getDefaultStoreId();
  const found = await prisma.menuItem.findMany({
    where: { id: { in: ids }, storeId, isFeatured: true },
    select: { id: true },
  });
  if (found.length !== ids.length) {
    throw ApiError.badRequest('One or more featured items were not found');
  }
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.menuItem.update({ where: { id }, data: { featuredOrder: index } }),
    ),
  );
  return listItems();
}

const MENU_SETTINGS_SELECT = {
  featuredTitle: true,
  featuredEnabled: true,
  takeawayCharge: true,
  bannerImageUrls: true,
  bannerTitle: true,
  bannerSubtitle: true,
} as const;

type MenuSettingsRow = {
  featuredTitle: string;
  featuredEnabled: boolean;
  takeawayCharge: unknown;
  bannerImageUrls: string[];
  bannerTitle: string | null;
  bannerSubtitle: string | null;
};

function toMenuSettingsDto(store: MenuSettingsRow | null) {
  return {
    featuredTitle: store?.featuredTitle ?? 'Popular',
    featuredEnabled: store?.featuredEnabled ?? true,
    takeawayCharge: Number(store?.takeawayCharge ?? 0),
    bannerImageUrls: store?.bannerImageUrls ?? [],
    bannerTitle: store?.bannerTitle ?? null,
    bannerSubtitle: store?.bannerSubtitle ?? null,
  };
}

export async function getMenuSettings() {
  const storeId = await getDefaultStoreId();
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: MENU_SETTINGS_SELECT,
  });
  return toMenuSettingsDto(store);
}

export async function updateMenuSettings(input: {
  featuredTitle?: string;
  featuredEnabled?: boolean;
  takeawayCharge?: number;
  bannerImageUrls?: string[];
  bannerTitle?: string | null;
  bannerSubtitle?: string | null;
}) {
  const storeId = await getDefaultStoreId();
  // Treat blank strings as "clear" so the customer menu falls back to defaults.
  const blankToNull = (v: string | null | undefined) =>
    v === undefined ? undefined : v && v.trim() ? v.trim() : null;
  const store = await prisma.store.update({
    where: { id: storeId },
    data: {
      ...(input.featuredTitle !== undefined ? { featuredTitle: input.featuredTitle } : {}),
      ...(input.featuredEnabled !== undefined ? { featuredEnabled: input.featuredEnabled } : {}),
      ...(input.takeawayCharge !== undefined ? { takeawayCharge: input.takeawayCharge } : {}),
      ...(input.bannerImageUrls !== undefined
        ? { bannerImageUrls: input.bannerImageUrls.filter((u) => u.trim()) }
        : {}),
      ...(input.bannerTitle !== undefined ? { bannerTitle: blankToNull(input.bannerTitle) } : {}),
      ...(input.bannerSubtitle !== undefined
        ? { bannerSubtitle: blankToNull(input.bannerSubtitle) }
        : {}),
    },
    select: MENU_SETTINGS_SELECT,
  });
  return toMenuSettingsDto(store);
}
