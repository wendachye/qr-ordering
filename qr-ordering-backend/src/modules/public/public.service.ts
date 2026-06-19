import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/response';
import { salePriceOf } from '../../lib/pricing';
import { currentStoreId } from '../../lib/tenant';

/** Loads an active table by its public code, together with its store. */
export async function getTableByCode(tableCode: string) {
  const table = await prisma.table.findUnique({
    where: { code: tableCode },
    include: { store: true },
  });

  if (!table) {
    throw ApiError.notFound(`Table "${tableCode}" was not found`);
  }
  if (!table.isActive) {
    throw ApiError.badRequest(`Table "${tableCode}" is not active`);
  }

  return {
    table: {
      id: table.id,
      name: table.name,
      code: table.code,
      isActive: table.isActive,
    },
    store: {
      id: table.store.id,
      name: table.store.name,
      slug: table.store.slug,
    },
  };
}

/**
 * Builds a store's menu (active categories + items) plus the featured strip.
 * `includePosOnly` is false for the customer menu (POS-only "secret" items are
 * hidden) and true for the staff POS menu.
 */
async function buildStoreMenu(storeId: string, opts: { includePosOnly: boolean }) {
  // Customer menu hides POS-only items; the POS menu includes them.
  const posFilter = opts.includePosOnly ? {} : { posOnly: false };

  const [settings, categories, featuredItems] = await Promise.all([
    prisma.store.findUnique({
      where: { id: storeId },
      select: {
        featuredTitle: true,
        featuredEnabled: true,
        takeawayCharge: true,
        bannerImageUrls: true,
        bannerTitle: true,
        bannerSubtitle: true,
      },
    }),
    prisma.menuCategory.findMany({
      where: { storeId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        items: {
          where: posFilter,
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: {
            optionGroups: {
              orderBy: { sortOrder: 'asc' },
              include: { choices: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
      },
    }),
    // Featured strip: featured + available items only, across all categories.
    prisma.menuItem.findMany({
      where: { storeId, isFeatured: true, isAvailable: true, ...posFilter },
      orderBy: [{ featuredOrder: 'asc' }, { name: 'asc' }],
      include: {
        optionGroups: {
          orderBy: { sortOrder: 'asc' },
          include: { choices: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    }),
  ]);

  type ItemPayload = (typeof featuredItems)[number];
  const mapItem = (item: ItemPayload) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    imageUrls: item.imageUrls,
    tag: item.tag,
    tags: item.tags,
    price: Number(item.price),
    salePrice: salePriceOf(Number(item.price), item.discountType, Number(item.discountValue ?? 0)),
    isAvailable: item.isAvailable,
    posOnly: item.posOnly,
    sortOrder: item.sortOrder,
    categoryId: item.categoryId,
    optionGroups: item.optionGroups.map((g) => ({
      id: g.id,
      name: g.name,
      required: g.required,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      choices: g.choices.map((ch) => ({
        id: ch.id,
        name: ch.name,
        priceDelta: Number(ch.priceDelta),
      })),
    })),
  });

  return {
    featuredTitle: settings?.featuredTitle ?? 'Popular',
    takeawayCharge: Number(settings?.takeawayCharge ?? 0),
    // Customer-menu hero banner. An empty image list / null copy falls back to
    // the default gradient/copy on the client; multiple images rotate.
    banner: {
      imageUrls: settings?.bannerImageUrls ?? [],
      title: settings?.bannerTitle ?? null,
      subtitle: settings?.bannerSubtitle ?? null,
    },
    // Master switch: hide the whole strip when the store has it turned off.
    featured: settings?.featuredEnabled === false ? [] : featuredItems.map(mapItem),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      items: c.items.map(mapItem),
    })),
  };
}

/** Customer menu for a table (POS-only "secret" items hidden). */
export async function getMenuForTable(tableCode: string) {
  const { table, store } = await getTableByCode(tableCode);
  const menu = await buildStoreMenu(store.id, { includePosOnly: false });
  return { store, table, ...menu };
}

/**
 * Staff POS menu for a table — same shape as the customer menu, but INCLUDES
 * POS-only items (each flagged `posOnly`). Authenticated + guarded so an admin
 * only ever reads their own store's menu.
 */
export async function getPosMenuForTable(tableCode: string) {
  const { table, store } = await getTableByCode(tableCode);
  if (store.id !== currentStoreId()) {
    throw ApiError.notFound(`Table "${tableCode}" was not found`);
  }
  const menu = await buildStoreMenu(store.id, { includePosOnly: true });
  return { store, table, ...menu };
}
