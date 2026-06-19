/**
 * scripts/apply-menu.ts — DEV: copy the "Sakura Japanese Dining" menu onto every
 * outlet of the "Demo F&B Group" client, replacing each outlet's starter menu.
 * Categories, items (images / tags / discounts / featured) and option groups +
 * choices are deep-copied with fresh ids. The SOURCE store is left untouched.
 *
 * DESTRUCTIVE to the target outlets' existing menus + idempotent (re-runnable).
 * Dev only.  npx tsx scripts/apply-menu.ts
 */
import { prisma } from '../src/lib/prisma';

const SOURCE_NAME = 'Sakura Japanese Dining';
const TARGET_CLIENT = 'Demo F&B Group';

async function loadSourceMenu(storeId: string) {
  const categories = await prisma.menuCategory.findMany({
    where: { storeId },
    orderBy: { sortOrder: 'asc' },
  });
  const items = await prisma.menuItem.findMany({
    where: { storeId },
    orderBy: { sortOrder: 'asc' },
    include: {
      optionGroups: {
        orderBy: { sortOrder: 'asc' },
        include: { choices: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  });
  return { categories, items };
}

type SourceMenu = Awaited<ReturnType<typeof loadSourceMenu>>;

async function applyMenu(targetStoreId: string, menu: SourceMenu) {
  await prisma.$transaction(
    async (tx) => {
      // Clear the outlet's current menu. OrderItem.menuItemId is ON DELETE SET
      // NULL (existing orders keep their snapshot); options cascade from the item.
      await tx.menuItem.deleteMany({ where: { storeId: targetStoreId } });
      await tx.menuCategory.deleteMany({ where: { storeId: targetStoreId } });

      const catMap = new Map<string, string>();
      for (const c of menu.categories) {
        const created = await tx.menuCategory.create({
          data: {
            storeId: targetStoreId,
            name: c.name,
            sortOrder: c.sortOrder,
            isActive: c.isActive,
          },
        });
        catMap.set(c.id, created.id);
      }

      for (const it of menu.items) {
        const categoryId = catMap.get(it.categoryId);
        if (!categoryId) continue;
        await tx.menuItem.create({
          data: {
            storeId: targetStoreId,
            categoryId,
            name: it.name,
            description: it.description,
            imageUrls: it.imageUrls,
            tag: it.tag,
            tags: it.tags,
            price: it.price,
            discountType: it.discountType,
            discountValue: it.discountValue,
            isAvailable: it.isAvailable,
            sortOrder: it.sortOrder,
            isFeatured: it.isFeatured,
            featuredOrder: it.featuredOrder,
            optionGroups: {
              create: it.optionGroups.map((g) => ({
                name: g.name,
                required: g.required,
                minSelect: g.minSelect,
                maxSelect: g.maxSelect,
                sortOrder: g.sortOrder,
                choices: {
                  create: g.choices.map((ch) => ({
                    name: ch.name,
                    priceDelta: ch.priceDelta,
                    sortOrder: ch.sortOrder,
                  })),
                },
              })),
            },
          },
        });
      }
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run in production.');
  }

  const source = await prisma.store.findFirst({
    where: { name: SOURCE_NAME },
    select: { id: true, name: true },
  });
  if (!source) throw new Error(`Source store "${SOURCE_NAME}" not found.`);

  const menu = await loadSourceMenu(source.id);
  const groupCount = menu.items.reduce((n, i) => n + i.optionGroups.length, 0);
  console.log(
    `Source "${source.name}": ${menu.categories.length} categories, ${menu.items.length} items, ${groupCount} option groups.`,
  );
  if (menu.categories.length === 0 || menu.items.length === 0) {
    throw new Error('Source menu is empty — aborting so the demo outlets are not wiped.');
  }

  const client = await prisma.client.findFirst({
    where: { name: TARGET_CLIENT },
    include: { outlets: { select: { id: true, name: true }, orderBy: { name: 'asc' } } },
  });
  if (!client) throw new Error(`Target client "${TARGET_CLIENT}" not found.`);
  if (client.outlets.length === 0) throw new Error('Target client has no outlets.');

  for (const outlet of client.outlets) {
    await applyMenu(outlet.id, menu);
    console.log(`  ✓ "${outlet.name}"`);
  }
  console.log(
    `\nDone — applied "${source.name}" menu to ${client.outlets.length} outlet(s) of "${client.name}".`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
