import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant } from '../helpers';

const round2 = (n: number) => Math.round(n * 100) / 100;

async function setup() {
  const { data } = await registerTenant();
  const token = data.token as string;
  const cats = (await api().get('/api/admin/menu/categories').set(auth(token))).body.data;
  const tables = (await api().get('/api/admin/tables').set(auth(token))).body.data;
  return { token, categoryId: cats[0].id as string, code: tables[0].code as string };
}

describe('menu item discount', () => {
  it('PERCENT: admin DTO + public menu expose salePrice; ordering charges it', async () => {
    const { token, categoryId, code } = await setup();
    const created = await api().post('/api/admin/menu/items').set(auth(token)).send({
      categoryId,
      name: 'Promo Roll',
      price: 20,
      discountType: 'PERCENT',
      discountValue: 25,
    });
    expect(created.status).toBe(201);
    expect(created.body.data.discountType).toBe('PERCENT');
    expect(created.body.data.salePrice).toBeCloseTo(15, 2);

    const menu = (await api().get(`/api/public/menu?tableCode=${code}`)).body.data;
    const pub = menu.categories
      .flatMap((c: any) => c.items)
      .find((i: any) => i.id === created.body.data.id);
    expect(pub.price).toBe(20);
    expect(pub.salePrice).toBeCloseTo(15, 2);

    // A public order is charged the discounted price (15 × 2 = 30).
    const order = await api()
      .post('/api/orders')
      .send({
        tableCode: code,
        items: [{ menuItemId: created.body.data.id, quantity: 2, optionChoiceIds: [] }],
      });
    expect(order.status).toBe(201);
    expect(order.body.data.total).toBeCloseTo(30, 2);
  });

  it('FIXED floors at zero; clearing the discount restores full price', async () => {
    const { token, categoryId, code } = await setup();
    const created = await api()
      .post('/api/admin/menu/items')
      .set(auth(token))
      .send({ categoryId, name: 'Freebie', price: 10, discountType: 'FIXED', discountValue: 999 });
    expect(created.status).toBe(201);
    expect(created.body.data.salePrice).toBe(0); // never below zero

    const free = await api()
      .post('/api/orders')
      .send({
        tableCode: code,
        items: [{ menuItemId: created.body.data.id, quantity: 1, optionChoiceIds: [] }],
      });
    expect(free.body.data.total).toBe(0);

    // Clear the discount.
    const cleared = await api()
      .patch(`/api/admin/menu/items/${created.body.data.id}`)
      .set(auth(token))
      .send({ discountType: null, discountValue: 0 });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.salePrice).toBeNull();

    const full = (await api().get(`/api/public/menu?tableCode=${code}`)).body.data.categories
      .flatMap((c: any) => c.items)
      .find((i: any) => i.id === created.body.data.id);
    expect(full.salePrice).toBeNull();
    expect(full.price).toBe(10);
  });

  it('rejects a percentage discount over 100', async () => {
    const { token, categoryId } = await setup();
    const res = await api()
      .post('/api/admin/menu/items')
      .set(auth(token))
      .send({ categoryId, name: 'Bad', price: 10, discountType: 'PERCENT', discountValue: 150 });
    expect(res.status).toBe(400);
  });
});
