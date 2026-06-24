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
      .patch(`/admin/menu/items/${item.id}/outlet-state`)
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

  it('an outlet can 86 or hide a shared item without affecting siblings', async () => {
    const a = (await registerTenant()).data;
    const catA = await catalogueOf(a.user.storeId);
    const category = await prisma.menuCategory.findFirst({ where: { catalogueId: catA } });
    const soldOutName = `SoldOut ${uid()}`;
    const hiddenName = `Hidden ${uid()}`;
    const mk = (name: string, sortOrder: number) =>
      prisma.menuItem.create({
        data: {
          storeId: a.user.storeId,
          catalogueId: catA,
          categoryId: category!.id,
          name,
          price: 7,
          sortOrder,
        },
      });
    const soldOut = await mk(soldOutName, 20);
    const hidden = await mk(hiddenName, 21);

    const b = (await registerTenant()).data;
    await prisma.store.update({ where: { id: b.user.storeId }, data: { catalogueId: catA } });
    const tableA = await prisma.table.findFirst({ where: { storeId: a.user.storeId } });
    const tableB = await prisma.table.findFirst({ where: { storeId: b.user.storeId } });

    // B 86's one item and stops offering another — both only at B.
    await api()
      .patch(`/admin/menu/items/${soldOut.id}/outlet-state`)
      .set(auth(b.token))
      .send({ isAvailable: false });
    await api()
      .patch(`/admin/menu/items/${hidden.id}/outlet-state`)
      .set(auth(b.token))
      .send({ isActive: false });

    const itemsOn = async (code: string) =>
      (
        (await api().get(`/public/menu?tableCode=${code}`)).body.data.categories as Array<{
          items: Array<{ name: string; isAvailable: boolean }>;
        }>
      ).flatMap((c) => c.items);
    const bItems = await itemsOn(tableB!.code);
    const aItems = await itemsOn(tableA!.code);

    // B: 86'd item shows but is unavailable; hidden item is gone entirely.
    expect(bItems.find((i) => i.name === soldOutName)?.isAvailable).toBe(false);
    expect(bItems.some((i) => i.name === hiddenName)).toBe(false);
    // A (sibling): both fully available + visible — overrides don't leak.
    expect(aItems.find((i) => i.name === soldOutName)?.isAvailable).toBe(true);
    expect(aItems.some((i) => i.name === hiddenName)).toBe(true);

    // Ordering B's 86'd item is rejected; A can still order it.
    const orderB = await api()
      .post('/orders')
      .send({ tableCode: tableB!.code, items: [{ menuItemId: soldOut.id, quantity: 1 }] });
    expect(orderB.status).toBe(400);
    const orderA = await api()
      .post('/orders')
      .send({ tableCode: tableA!.code, items: [{ menuItemId: soldOut.id, quantity: 1 }] });
    expect(orderA.status).toBe(201);
  });

  it('tracks stock per outlet on a shared catalogue', async () => {
    const a = (await registerTenant()).data;
    const catA = await catalogueOf(a.user.storeId);
    const category = await prisma.menuCategory.findFirst({ where: { catalogueId: catA } });
    const dishName = `Stocked Dish ${uid()}`;
    const item = await prisma.menuItem.create({
      data: {
        storeId: a.user.storeId,
        catalogueId: catA,
        categoryId: category!.id,
        name: dishName,
        price: 9,
        sortOrder: 30,
      },
    });

    const b = (await registerTenant()).data;
    await prisma.store.update({ where: { id: b.user.storeId }, data: { catalogueId: catA } });
    const tableA = await prisma.table.findFirst({ where: { storeId: a.user.storeId } });
    const tableB = await prisma.table.findFirst({ where: { storeId: b.user.storeId } });
    const orderAt = (code: string, quantity: number) =>
      api()
        .post('/orders')
        .send({ tableCode: code, items: [{ menuItemId: item.id, quantity }] });

    // B tracks 2 units of the shared item; A leaves it untracked (unlimited).
    const cfg = await api()
      .patch(`/admin/inventory/${item.id}/config`)
      .set(auth(b.token))
      .send({ trackStock: true, stockQty: 2 });
    expect(cfg.status).toBe(200);

    // B sells both → sold out at B; B's next order is rejected, A orders freely.
    expect((await orderAt(tableB!.code, 2)).status).toBe(201);
    expect((await orderAt(tableB!.code, 1)).status).toBe(400);
    expect((await orderAt(tableA!.code, 5)).status).toBe(201);

    // B's list shows it tracked + sold out; A's shows it untracked + available.
    const itemFor = async (token: string) =>
      (
        (await api().get('/admin/menu/items').set(auth(token))).body.data as Array<{
          id: string;
          trackStock: boolean;
          stockQty: number;
          isAvailable: boolean;
        }>
      ).find((i) => i.id === item.id)!;
    const atB = await itemFor(b.token);
    expect(atB.trackStock).toBe(true);
    expect(atB.stockQty).toBe(0);
    expect(atB.isAvailable).toBe(false);
    const atA = await itemFor(a.token);
    expect(atA.trackStock).toBe(false);
    expect(atA.isAvailable).toBe(true);
  });

  it('reports catalogue sharing + counts entitlement items per catalogue', async () => {
    const a = (await registerTenant()).data;
    const catA = await catalogueOf(a.user.storeId);
    const category = await prisma.menuCategory.findFirst({ where: { catalogueId: catA } });
    // A's catalogue: seeded "Sample Dish" + one we add → 2 items.
    await prisma.menuItem.create({
      data: {
        storeId: a.user.storeId,
        catalogueId: catA,
        categoryId: category!.id,
        name: `Extra Dish ${uid()}`,
        price: 6,
        sortOrder: 40,
      },
    });
    const info = (s: { token: string }) => api().get('/admin/menu/catalogue').set(auth(s.token));
    const ent = (s: { token: string }) => api().get('/admin/entitlements').set(auth(s.token));

    // Solo outlet: catalogue not shared; its own item count.
    const solo = (await info(a)).body.data;
    expect(solo.shared).toBe(false);
    expect(solo.outletCount).toBe(1);
    const aItems = (await ent(a)).body.data.usage.menuItems;
    expect(aItems).toBe(2);

    // Share A's catalogue with outlet B.
    const b = (await registerTenant()).data;
    await prisma.store.update({ where: { id: b.user.storeId }, data: { catalogueId: catA } });

    // Both outlets now report the catalogue shared by 2.
    expect((await info(a)).body.data).toMatchObject({ shared: true, outletCount: 2 });
    expect((await info(b)).body.data).toMatchObject({ shared: true, outletCount: 2 });

    // Entitlement item usage is the CATALOGUE's count for both — B sees A's 2
    // items (per-catalogue), not its own former store count (would be 1).
    expect((await ent(b)).body.data.usage.menuItems).toBe(2);
  });
});
