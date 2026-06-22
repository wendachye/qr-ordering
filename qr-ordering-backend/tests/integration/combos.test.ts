import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant } from '../helpers';

async function ctx() {
  const { data } = await registerTenant();
  const token = data.token as string;
  const cats = (await api().get('/admin/menu/categories').set(auth(token))).body.data;
  const categoryId = cats[0].id as string;
  const mk = (name: string, price: number) =>
    api()
      .post('/admin/menu/items')
      .set(auth(token))
      .send({ categoryId, name, price })
      .then((r) => r.body.data);
  const items = [await mk('Combo Item A', 8), await mk('Combo Item B', 6)];
  const tables = (await api().get('/admin/tables').set(auth(token))).body.data;
  return { token, items, code: tables[0].code as string };
}

describe('combos / set meals (B3)', () => {
  it('creates a combo, lists it on the menu, and prices an order from the picks', async () => {
    const { token, items, code } = await ctx();
    const created = await api()
      .post('/admin/menu/combos')
      .set(auth(token))
      .send({
        name: 'Lunch Set',
        price: 15,
        groups: [
          {
            name: 'Main',
            options: [{ menuItemId: items[0].id }, { menuItemId: items[1].id, priceDelta: 2 }],
          },
          { name: 'Drink', options: [{ menuItemId: items[0].id }] },
        ],
      });
    expect(created.status).toBe(201);
    const combo = created.body.data;
    expect(combo.groups).toHaveLength(2);

    // Appears on the customer menu.
    const menu = (await api().get(`/public/menu?tableCode=${code}`)).body.data;
    expect(menu.combos.map((c: any) => c.id)).toContain(combo.id);

    // Order it: premium main (+2) + the drink → unit = 17; ×2 = 34.
    const mainGroup = combo.groups[0];
    const premium = mainGroup.options.find((o: any) => o.priceDelta === 2);
    const drinkGroup = combo.groups[1];
    const order = await api()
      .post('/orders')
      .send({
        tableCode: code,
        items: [
          {
            comboId: combo.id,
            quantity: 2,
            comboSelections: [
              { groupId: mainGroup.id, optionId: premium.id },
              { groupId: drinkGroup.id, optionId: drinkGroup.options[0].id },
            ],
          },
        ],
      });
    expect(order.status).toBe(201);
    expect(order.body.data.total).toBeCloseTo(34, 2);

    // The tab shows the combo line with its component snapshot.
    const sessionId = order.body.data.sessionId;
    const session = (await api().get(`/admin/sessions/${sessionId}`).set(auth(token))).body.data;
    const line = session.rounds[0].items[0];
    expect(line.name).toBe('Lunch Set');
    expect(line.selectedOptions).toHaveLength(2);
    expect(line.totalPrice).toBeCloseTo(34, 2);
  });

  it('rejects a combo order missing a required group pick', async () => {
    const { token, items, code } = await ctx();
    const combo = (
      await api()
        .post('/admin/menu/combos')
        .set(auth(token))
        .send({ name: 'Set B', price: 10, groups: [{ name: 'Main', options: [{ menuItemId: items[0].id }] }] })
    ).body.data;
    const res = await api()
      .post('/orders')
      .send({ tableCode: code, items: [{ comboId: combo.id, quantity: 1, comboSelections: [] }] });
    expect(res.status).toBe(400);
  });

  it('rejects a combo option that is not on this store menu', async () => {
    const { token, items } = await ctx();
    const res = await api()
      .post('/admin/menu/combos')
      .set(auth(token))
      .send({
        name: 'Bad Set',
        price: 10,
        groups: [{ name: 'Main', options: [{ menuItemId: items[0].id }, { menuItemId: 'nope_xxx' }] }],
      });
    expect(res.status).toBe(400);
  });
});
