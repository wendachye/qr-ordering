import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant } from '../helpers';

async function ctx() {
  const { data } = await registerTenant();
  const token = data.token as string;
  const cats = (await api().get('/admin/menu/categories').set(auth(token))).body.data;
  const tables = (await api().get('/admin/tables').set(auth(token))).body.data;
  return { token, categoryId: cats[0].id as string, code: tables[0].code as string };
}

const idsOnMenu = (menu: any): string[] =>
  menu.categories.flatMap((c: any) => c.items).map((i: any) => i.id);

describe('item availability scheduling (B2)', () => {
  it('hides an off-schedule item from diners but lets staff order it', async () => {
    const { token, categoryId, code } = await ctx();
    // Available only on a day that isn't today → off-schedule right now.
    const otherDay = (new Date().getDay() + 3) % 7;
    const created = await api()
      .post('/admin/menu/items')
      .set(auth(token))
      .send({ categoryId, name: 'Night Owl Special', price: 12, availableDays: [otherDay] });
    expect(created.status).toBe(201);
    const itemId = created.body.data.id as string;

    // Customer menu hides it.
    const menu = (await api().get(`/public/menu?tableCode=${code}`)).body.data;
    expect(idsOnMenu(menu)).not.toContain(itemId);

    // A diner can't order it.
    const diner = await api()
      .post('/orders')
      .send({ tableCode: code, items: [{ menuItemId: itemId, quantity: 1 }] });
    expect(diner.status).toBe(400);

    // Staff can (POS override).
    const staff = await api()
      .post('/admin/orders')
      .set(auth(token))
      .send({ tableCode: code, items: [{ menuItemId: itemId, quantity: 1 }] });
    expect(staff.status).toBe(201);
  });

  it('shows an item that is within its window today', async () => {
    const { token, categoryId, code } = await ctx();
    const created = await api()
      .post('/admin/menu/items')
      .set(auth(token))
      .send({ categoryId, name: 'Today Item', price: 10, availableDays: [new Date().getDay()] });
    const itemId = created.body.data.id as string;

    const menu = (await api().get(`/public/menu?tableCode=${code}`)).body.data;
    expect(idsOnMenu(menu)).toContain(itemId);
  });

  it('rejects a malformed time window', async () => {
    const { token, categoryId } = await ctx();
    const res = await api()
      .post('/admin/menu/items')
      .set(auth(token))
      .send({ categoryId, name: 'Bad Time', price: 5, availableFrom: '9am' });
    expect(res.status).toBe(400);
  });
});
