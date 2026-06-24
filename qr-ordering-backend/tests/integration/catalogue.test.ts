import { describe, it, expect } from 'vitest';

import { api, registerTenant, uid } from '../helpers';
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
});
