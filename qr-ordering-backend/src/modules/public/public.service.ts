import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/response';
import { salePriceOf } from '../../lib/pricing';

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

/** Loads the menu (active categories + items) plus the featured strip. */
export async function getMenuForTable(tableCode: string) {
  const { table, store } = await getTableByCode(tableCode);

  const [settings, categories, featuredItems] = await Promise.all([
    prisma.store.findUnique({
      where: { id: store.id },
      select: {
        featuredTitle: true,
        takeawayCharge: true,
        bannerImageUrls: true,
        bannerTitle: true,
        bannerSubtitle: true,
      },
    }),
    prisma.menuCategory.findMany({
      where: { storeId: store.id, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        items: {
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
      where: { storeId: store.id, isFeatured: true, isAvailable: true },
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
    store,
    table,
    featuredTitle: settings?.featuredTitle ?? 'Popular',
    takeawayCharge: Number(settings?.takeawayCharge ?? 0),
    // Customer-menu hero banner. An empty image list / null copy falls back to
    // the default gradient/copy on the client; multiple images rotate.
    banner: {
      imageUrls: settings?.bannerImageUrls ?? [],
      title: settings?.bannerTitle ?? null,
      subtitle: settings?.bannerSubtitle ?? null,
    },
    featured: featuredItems.map(mapItem),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      items: c.items.map(mapItem),
    })),
  };
}
