import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

import { makePrismaClient } from '../src/lib/makePrisma';

// Prisma 7 no longer auto-loads .env; load it so DATABASE_URL is set when the
// seed runs directly (`pnpm db:seed`).
dotenv.config({ quiet: true });

const prisma = makePrismaClient();

// Demo images: simple SVG placeholders written into the same /uploads dir the
// upload endpoint uses, so the customer carousel has something to show.
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function svgPlaceholder(label: string, subtitle: string, hue: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${hue}, 62%, 55%)"/>
    <stop offset="1" stop-color="hsl(${(hue + 35) % 360}, 68%, 38%)"/>
  </linearGradient></defs>
  <rect width="640" height="480" fill="url(#g)"/>
  <text x="320" y="238" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="bold" fill="#ffffff" text-anchor="middle">${label}</text>
  <text x="320" y="286" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="rgba(255,255,255,0.85)" text-anchor="middle">${subtitle}</text>
</svg>`;
}

function makePlaceholderImages(name: string, count: number, hue: number): string[] {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const urls: string[] = [];
  for (let i = 1; i <= count; i++) {
    const file = `seed-${slugify(name)}-${i}.svg`;
    fs.writeFileSync(
      path.join(UPLOADS_DIR, file),
      svgPlaceholder(name, `Photo ${i} of ${count}`, hue),
    );
    urls.push(`/uploads/${file}`);
  }
  return urls;
}

type OptionChoiceDef = { name: string; priceDelta?: number };
type OptionGroupDef = {
  name: string;
  required?: boolean;
  minSelect?: number;
  maxSelect?: number;
  choices: OptionChoiceDef[];
};
type ItemDef = {
  name: string;
  price: number;
  category: string;
  sortOrder: number;
  images: number;
  hue: number;
  tag?: string;
  options?: OptionGroupDef[];
};

const COOKING: OptionGroupDef = {
  name: 'Cooking method',
  required: true,
  choices: [{ name: 'Shioyaki (grilled with salt)' }, { name: 'Teriyaki' }],
};
const SPICE: OptionGroupDef = {
  name: 'Spice level',
  required: true,
  choices: [{ name: 'Mild' }, { name: 'Medium' }, { name: 'Hot' }],
};

async function main() {
  // ----- Store -----
  const store = await prisma.store.upsert({
    where: { slug: 'demo-restaurant' },
    update: { name: 'Sakura Japanese Dining' },
    create: { name: 'Sakura Japanese Dining', slug: 'demo-restaurant' },
  });
  console.log(`Store: ${store.name} (${store.slug})`);

  // ----- Client (platform account that owns this outlet) -----
  // Deterministic id matches the migration backfill (cl_<storeId>).
  const client = await prisma.client.upsert({
    where: { id: `cl_${store.id}` },
    update: {},
    create: { id: `cl_${store.id}`, name: store.name },
  });
  if (store.clientId !== client.id) {
    await prisma.store.update({ where: { id: store.id }, data: { clientId: client.id } });
  }

  // ----- Catalogue (the shared brand menu this outlet serves) -----
  // Reuse the store's catalogue when one already exists (1:1 backfill), else
  // provision a deterministic one so re-seeds are idempotent and catalogue-based
  // reads (customer menu, admin, orders) resolve. Categories + items below are
  // stamped with this catalogueId.
  const catalogueId = store.catalogueId ?? `cat_${store.id}`;
  await prisma.catalogue.upsert({
    where: { id: catalogueId },
    update: {},
    create: { id: catalogueId, name: store.name, clientId: client.id },
  });
  if (store.catalogueId !== catalogueId) {
    await prisma.store.update({ where: { id: store.id }, data: { catalogueId } });
  }

  // ----- Admin user -----
  const passwordHash = await bcrypt.hash('password123', 10);
  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@example.com' },
    update: {
      password: passwordHash,
      name: 'Demo Admin',
      storeId: store.id,
      isPlatformAdmin: true,
    },
    create: {
      email: 'admin@example.com',
      password: passwordHash,
      name: 'Demo Admin',
      storeId: store.id,
      isPlatformAdmin: true,
    },
  });
  console.log(`Admin: ${admin.email} / password123`);

  // ----- Subscription plans (configurable tiers; editable by a super-admin) -----
  // update:{} so re-seeding never clobbers an operator's later edits.
  const seedPlans = [
    {
      key: 'basic',
      name: 'Basic',
      description: 'Everything to run a small restaurant — menu, tables, POS and daily totals.',
      monthlyPrice: 49,
      currency: 'MYR',
      stripePriceId: process.env.STRIPE_PRICE_BASIC ?? process.env.STRIPE_PRICE_STARTER ?? null,
      features: [] as string[],
      maxTables: 10 as number | null,
      maxMenuItems: 50 as number | null,
      sortOrder: 0,
    },
    {
      key: 'pro',
      name: 'Pro',
      description: 'Loyalty, vouchers, full analytics, multi-tax and unlimited scale.',
      monthlyPrice: 99,
      currency: 'MYR',
      stripePriceId: process.env.STRIPE_PRICE_PRO ?? null,
      features: ['loyalty', 'vouchers', 'reports_advanced', 'tax_multi'],
      maxTables: null as number | null,
      maxMenuItems: null as number | null,
      sortOrder: 1,
    },
  ];
  for (const p of seedPlans) {
    await prisma.plan.upsert({ where: { key: p.key }, update: {}, create: p });
  }
  console.log(`Plans: ${seedPlans.map((p) => p.key).join(', ')}`);

  // ----- Tables (Table 1..10 -> TBL001..TBL010) -----
  for (let i = 1; i <= 10; i++) {
    const code = `TBL${String(i).padStart(3, '0')}`;
    await prisma.table.upsert({
      where: { code },
      update: { name: `Table ${i}`, isActive: true, storeId: store.id },
      create: { name: `Table ${i}`, code, storeId: store.id },
    });
  }
  console.log('Tables: TBL001..TBL010');

  // ----- Categories (enough to scroll the category bar) -----
  const categoryDefs = [
    'Sashimi',
    'Sushi',
    'Ramen',
    'Tempura',
    'Donburi',
    'Yakimono',
    'Drinks',
    'Dessert',
  ];
  const categoryIdByName = new Map<string, string>();
  for (const [idx, name] of categoryDefs.entries()) {
    const existing = await prisma.menuCategory.findFirst({ where: { storeId: store.id, name } });
    const category = existing
      ? await prisma.menuCategory.update({
          where: { id: existing.id },
          data: { sortOrder: idx + 1, isActive: true, catalogueId },
        })
      : await prisma.menuCategory.create({
          data: { storeId: store.id, catalogueId, name, sortOrder: idx + 1 },
        });
    categoryIdByName.set(name, category.id);
  }
  console.log(`Categories: ${categoryDefs.join(', ')}`);

  // ----- Items (with option groups) -----
  const itemDefs: ItemDef[] = [
    // Sashimi
    {
      name: 'Salmon Sashimi',
      price: 18,
      category: 'Sashimi',
      sortOrder: 1,
      images: 2,
      hue: 12,
      tag: 'Popular',
    },
    { name: 'Tuna Sashimi', price: 20, category: 'Sashimi', sortOrder: 2, images: 1, hue: 350 },
    {
      name: 'Sashimi Moriawase',
      price: 38,
      category: 'Sashimi',
      sortOrder: 3,
      images: 2,
      hue: 200,
      tag: "Chef's",
    },
    // Sushi
    { name: 'Salmon Nigiri', price: 8, category: 'Sushi', sortOrder: 1, images: 1, hue: 18 },
    { name: 'Ebi Nigiri', price: 7, category: 'Sushi', sortOrder: 2, images: 1, hue: 30 },
    { name: 'California Roll', price: 16, category: 'Sushi', sortOrder: 3, images: 2, hue: 45 },
    // Ramen
    {
      name: 'Tonkotsu Ramen',
      tag: 'Hot',
      price: 22,
      category: 'Ramen',
      sortOrder: 1,
      images: 2,
      hue: 28,
      options: [
        SPICE,
        {
          name: 'Add-ons',
          required: false,
          minSelect: 0,
          maxSelect: 3,
          choices: [
            { name: 'Extra Chashu', priceDelta: 5 },
            { name: 'Ajitama Egg', priceDelta: 3 },
            { name: 'Extra Noodles', priceDelta: 3 },
          ],
        },
      ],
    },
    {
      name: 'Shoyu Ramen',
      price: 20,
      category: 'Ramen',
      sortOrder: 2,
      images: 1,
      hue: 36,
      options: [SPICE],
    },
    {
      name: 'Miso Ramen',
      price: 21,
      category: 'Ramen',
      sortOrder: 3,
      images: 1,
      hue: 40,
      tag: 'Spicy',
      options: [SPICE],
    },
    // Tempura
    { name: 'Ebi Tempura', price: 18, category: 'Tempura', sortOrder: 1, images: 1, hue: 48 },
    { name: 'Vegetable Tempura', price: 14, category: 'Tempura', sortOrder: 2, images: 1, hue: 90 },
    // Donburi
    {
      name: 'Chicken Teriyaki Don',
      price: 16,
      category: 'Donburi',
      sortOrder: 1,
      images: 2,
      hue: 34,
      options: [
        {
          name: 'Rice size',
          required: true,
          choices: [{ name: 'Regular' }, { name: 'Large', priceDelta: 3 }],
        },
      ],
    },
    {
      name: 'Gyudon (Beef Bowl)',
      price: 18,
      category: 'Donburi',
      sortOrder: 2,
      images: 1,
      hue: 20,
    },
    {
      name: 'Unagi Don',
      price: 28,
      category: 'Donburi',
      sortOrder: 3,
      images: 1,
      hue: 26,
      tag: "Chef's",
    },
    // Yakimono (grilled)
    {
      name: 'Grilled Salmon',
      price: 24,
      category: 'Yakimono',
      sortOrder: 1,
      images: 2,
      hue: 14,
      options: [COOKING],
    },
    {
      name: 'Grilled Saba Mackerel',
      price: 18,
      category: 'Yakimono',
      sortOrder: 2,
      images: 1,
      hue: 205,
      options: [COOKING],
    },
    {
      name: 'Chicken Yakitori',
      price: 12,
      category: 'Yakimono',
      sortOrder: 3,
      images: 1,
      hue: 32,
      options: [
        {
          name: 'Sauce',
          required: true,
          choices: [{ name: 'Tare (sweet soy)' }, { name: 'Shio (salt)' }],
        },
      ],
    },
    // Drinks
    {
      name: 'Matcha Latte',
      price: 10,
      category: 'Drinks',
      sortOrder: 1,
      images: 1,
      hue: 120,
      options: [
        { name: 'Temperature', required: true, choices: [{ name: 'Hot' }, { name: 'Iced' }] },
        {
          name: 'Sweetness',
          required: true,
          choices: [{ name: '0%' }, { name: '50%' }, { name: '100%' }],
        },
      ],
    },
    { name: 'Green Tea', price: 5, category: 'Drinks', sortOrder: 2, images: 1, hue: 130 },
    {
      name: 'Ramune Soda',
      price: 7,
      category: 'Drinks',
      sortOrder: 3,
      images: 1,
      hue: 190,
      options: [
        {
          name: 'Flavour',
          required: true,
          choices: [{ name: 'Original' }, { name: 'Lychee' }, { name: 'Strawberry' }],
        },
      ],
    },
    // Dessert
    {
      name: 'Mochi Ice Cream',
      price: 9,
      category: 'Dessert',
      sortOrder: 1,
      images: 1,
      hue: 320,
      options: [
        {
          name: 'Flavour',
          required: true,
          choices: [{ name: 'Pandan' }, { name: 'Red Bean' }, { name: 'Matcha' }],
        },
      ],
    },
    {
      name: 'Dorayaki',
      price: 8,
      category: 'Dessert',
      sortOrder: 2,
      images: 1,
      hue: 36,
      options: [
        {
          name: 'Filling',
          required: true,
          choices: [{ name: 'Red Bean' }, { name: 'Custard' }],
        },
      ],
    },
    {
      name: 'Matcha Cheesecake',
      price: 12,
      category: 'Dessert',
      sortOrder: 3,
      images: 1,
      hue: 110,
    },
  ];

  let optionGroupCount = 0;
  for (const def of itemDefs) {
    const categoryId = categoryIdByName.get(def.category)!;
    const imageUrls = makePlaceholderImages(def.name, def.images, def.hue);

    const existing = await prisma.menuItem.findFirst({
      where: { storeId: store.id, name: def.name },
    });
    const item = existing
      ? await prisma.menuItem.update({
          where: { id: existing.id },
          data: {
            price: def.price,
            categoryId,
            catalogueId,
            sortOrder: def.sortOrder,
            isAvailable: true,
            imageUrls,
            tag: def.tag ?? null,
          },
        })
      : await prisma.menuItem.create({
          data: {
            storeId: store.id,
            catalogueId,
            categoryId,
            name: def.name,
            price: def.price,
            sortOrder: def.sortOrder,
            imageUrls,
            tag: def.tag ?? null,
          },
        });

    // Rebuild option groups for this item (idempotent).
    await prisma.optionGroup.deleteMany({ where: { menuItemId: item.id } });
    for (const [gi, g] of (def.options ?? []).entries()) {
      await prisma.optionGroup.create({
        data: {
          menuItemId: item.id,
          name: g.name,
          required: g.required ?? true,
          minSelect: g.minSelect ?? 1,
          maxSelect: g.maxSelect ?? 1,
          sortOrder: gi,
          choices: {
            create: g.choices.map((c, ci) => ({
              name: c.name,
              priceDelta: c.priceDelta ?? 0,
              sortOrder: ci,
            })),
          },
        },
      });
      optionGroupCount++;
    }
  }
  console.log(`Items: ${itemDefs.length} (with ${optionGroupCount} option groups)`);

  console.log('\nSeed complete ✅');
  console.log('  Customer:  open menu with table code TBL001');
  console.log('  Admin:     admin@example.com / password123');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
