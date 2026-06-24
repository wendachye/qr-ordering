import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant, uid } from '../helpers';
import { prisma } from '../../src/lib/prisma';

const catalogueOf = async (storeId: string) =>
  (await prisma.store.findUnique({ where: { id: storeId }, select: { catalogueId: true } }))!
    .catalogueId!;

describe('shared brand catalogue', () => {
  it('two outlets sharing one catalogue serve the same menu and can both order it', async () => {
    // Outlet A — its brand catalogue, with a uniquely-named item.
    const a = (await registerTenant()).data;
    const catA = await catalogueOf(a.user.storeId);
    const category = await prisma.menuCategory.findFirst({ where: { catalogueId: catA } });
    const dishName = `Shared Dish ${uid()}`;
    const item = await prisma.menuItem.create({
      data: {
        storeId: a.user.storeId,
        catalogueId: catA,
        categoryId: category!.id,
        name: dishName,
        price: 12,
        sortOrder: 5,
      },
    });

    // Outlet B — a separate outlet; point it at A's catalogue (share the brand menu).
    const b = (await registerTenant()).data;
    expect(await catalogueOf(b.user.storeId)).not.toBe(catA); // started with its own
    await prisma.store.update({ where: { id: b.user.storeId }, data: { catalogueId: catA } });
    const tableB = await prisma.table.findFirst({ where: { storeId: b.user.storeId } });

    // B's customer menu now serves A's catalogue item.
    const menu = (await api().get(`/public/menu?tableCode=${tableB!.code}`)).body.data;
    const names = (menu.categories as Array<{ items: Array<{ name: string }> }>)
      .flatMap((c) => c.items)
      .map((i) => i.name);
    expect(names).toContain(dishName);

    // And an order at B for A's catalogue item succeeds (validated against B's
    // catalogue, which is now A's).
    const order = await api()
      .post('/orders')
      .send({ tableCode: tableB!.code, items: [{ menuItemId: item.id, quantity: 1 }] });
    expect(order.status).toBe(201);
    expect(order.body.success).toBe(true);
  });

  it('a shared catalogue is editable from any outlet', async () => {
    const a = (await registerTenant()).data;
    const catA = await catalogueOf(a.user.storeId);
    const b = (await registerTenant()).data;
    await prisma.store.update({ where: { id: b.user.storeId }, data: { catalogueId: catA } });

    // B's admin menu now lists A's catalogue (the seeded "Sample Dish").
    const bList = (await api().get('/admin/menu/items').set(auth(b.token))).body.data as Array<{
      name: string;
    }>;
    expect(bList.some((i) => i.name === 'Sample Dish')).toBe(true);

    // B adds a category + item to the shared catalogue...
    const cat = (
      await api()
        .post('/admin/menu/categories')
        .set(auth(b.token))
        .send({ name: `B Cat ${uid()}` })
    ).body.data;
    const dishName = `B Dish ${uid()}`;
    const created = (
      await api()
        .post('/admin/menu/items')
        .set(auth(b.token))
        .send({ categoryId: cat.id, name: dishName, price: 8 })
    ).body.data;
    expect(created.name).toBe(dishName);

    // ...and outlet A sees it (same catalogue).
    const aList = (await api().get('/admin/menu/items').set(auth(a.token))).body.data as Array<{
      name: string;
    }>;
    expect(aList.some((i) => i.name === dishName)).toBe(true);
  });

  it('an outlet can override the price on a shared catalogue (menu + order)', async () => {
    const a = (await registerTenant()).data;
    const catA = await catalogueOf(a.user.storeId);
    const category = await prisma.menuCategory.findFirst({ where: { catalogueId: catA } });
    const dishName = `Priced Dish ${uid()}`;
    const item = await prisma.menuItem.create({
      data: {
        storeId: a.user.storeId,
        catalogueId: catA,
        categoryId: category!.id,
        name: dishName,
        price: 10,
        sortOrder: 9,
      },
    });

    const b = (await registerTenant()).data;
    await prisma.store.update({ where: { id: b.user.storeId }, data: { catalogueId: catA } });
    const tableA = await prisma.table.findFirst({ where: { storeId: a.user.storeId } });
    const tableB = await prisma.table.findFirst({ where: { storeId: b.user.storeId } });

    // B sets its own price for the shared item.
    const set = await api()
      .patch(`/admin/menu/items/${item.id}/outlet-price`)
      .set(auth(b.token))
      .send({ price: 15 });
    expect(set.status).toBe(200);
    expect(set.body.data.outletPrice).toBe(15);

    // B's customer menu shows 15; A's still shows the catalogue 10.
    const priceOnMenu = async (code: string) => {
      const res = await api().get(`/public/menu?tableCode=${code}`);
      return (res.body.data.categories as Array<{ items: Array<{ name: string; price: number }> }>)
        .flatMap((c) => c.items)
        .find((i) => i.name === dishName)?.price;
    };
    expect(await priceOnMenu(tableB!.code)).toBe(15);
    expect(await priceOnMenu(tableA!.code)).toBe(10);

    // An order at B is charged B's price (2 × 15 = 30), not the catalogue 10.
    const order = await api()
      .post('/orders')
      .send({ tableCode: tableB!.code, items: [{ menuItemId: item.id, quantity: 2 }] });
    expect(order.status).toBe(201);
    expect(order.body.data.total).toBe(30);
  });
});
