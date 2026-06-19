import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant } from '../helpers';

async function ctx() {
  const { data } = await registerTenant();
  const token = data.token as string;
  const cats = (await api().get('/api/admin/menu/categories').set(auth(token))).body.data;
  return { token, categoryId: cats[0].id as string };
}

describe('configurable menu item options', () => {
  it('creates an item with option groups + choices (ordered)', async () => {
    const { token, categoryId } = await ctx();
    const res = await api()
      .post('/api/admin/menu/items')
      .set(auth(token))
      .send({
        categoryId,
        name: 'Build-a-bowl',
        price: 10,
        optionGroups: [
          {
            name: 'Size',
            required: true,
            minSelect: 1,
            maxSelect: 1,
            choices: [
              { name: 'Regular', priceDelta: 0 },
              { name: 'Large', priceDelta: 3 },
            ],
          },
          {
            name: 'Toppings',
            required: false,
            minSelect: 0,
            maxSelect: 2,
            choices: [
              { name: 'Egg', priceDelta: 2 },
              { name: 'Avocado', priceDelta: 4 },
            ],
          },
        ],
      });
    expect(res.status).toBe(201);
    const item = res.body.data;
    expect(item.optionGroups).toHaveLength(2);
    const size = item.optionGroups.find((g: any) => g.name === 'Size');
    expect(size.required).toBe(true);
    expect(size.maxSelect).toBe(1);
    expect(size.choices.map((c: any) => c.name)).toEqual(['Regular', 'Large']);
    expect(size.choices.find((c: any) => c.name === 'Large').priceDelta).toBeCloseTo(3, 2);
  });

  it('surfaces options on the public menu and prices a chosen option on order', async () => {
    const { token, categoryId } = await ctx();
    const created = (
      await api()
        .post('/api/admin/menu/items')
        .set(auth(token))
        .send({
          categoryId,
          name: 'Ramen',
          price: 12,
          optionGroups: [
            {
              name: 'Extra',
              required: false,
              minSelect: 0,
              maxSelect: 1,
              choices: [{ name: 'Extra egg', priceDelta: 2 }],
            },
          ],
        })
    ).body.data;

    const tables = (await api().get('/api/admin/tables').set(auth(token))).body.data;
    const code = tables[0].code as string;
    const menu = (await api().get(`/api/public/menu?tableCode=${code}`)).body.data;
    const pub = menu.categories.flatMap((c: any) => c.items).find((i: any) => i.id === created.id);
    expect(pub.optionGroups[0].choices[0].name).toBe('Extra egg');
    const choiceId = pub.optionGroups[0].choices[0].id as string;

    const order = await api()
      .post('/api/admin/orders')
      .set(auth(token))
      .send({
        tableCode: code,
        items: [{ menuItemId: created.id, quantity: 1, optionChoiceIds: [choiceId] }],
      });
    expect(order.status).toBe(201);
    expect(order.body.data.total).toBeCloseTo(14, 2); // 12 base + 2 option
  });

  it('full-replaces option groups on update', async () => {
    const { token, categoryId } = await ctx();
    const created = (
      await api()
        .post('/api/admin/menu/items')
        .set(auth(token))
        .send({
          categoryId,
          name: 'Sandwich',
          price: 8,
          optionGroups: [
            {
              name: 'Bread',
              required: true,
              minSelect: 1,
              maxSelect: 1,
              choices: [{ name: 'White', priceDelta: 0 }],
            },
          ],
        })
    ).body.data;

    const updated = (
      await api()
        .patch(`/api/admin/menu/items/${created.id}`)
        .set(auth(token))
        .send({
          optionGroups: [
            {
              name: 'Cheese',
              required: false,
              minSelect: 0,
              maxSelect: 1,
              choices: [{ name: 'Cheddar', priceDelta: 1.5 }],
            },
          ],
        })
    ).body.data;
    expect(updated.optionGroups).toHaveLength(1);
    expect(updated.optionGroups[0].name).toBe('Cheese');
    expect(updated.optionGroups[0].choices[0].name).toBe('Cheddar');
  });

  it('clears options when sent an empty array', async () => {
    const { token, categoryId } = await ctx();
    const created = (
      await api()
        .post('/api/admin/menu/items')
        .set(auth(token))
        .send({
          categoryId,
          name: 'Plain',
          price: 5,
          optionGroups: [
            {
              name: 'X',
              required: true,
              minSelect: 1,
              maxSelect: 1,
              choices: [{ name: 'A', priceDelta: 0 }],
            },
          ],
        })
    ).body.data;
    const updated = (
      await api()
        .patch(`/api/admin/menu/items/${created.id}`)
        .set(auth(token))
        .send({ optionGroups: [] })
    ).body.data;
    expect(updated.optionGroups).toHaveLength(0);
  });

  it('rejects an invalid group (min greater than max)', async () => {
    const { token, categoryId } = await ctx();
    const res = await api()
      .post('/api/admin/menu/items')
      .set(auth(token))
      .send({
        categoryId,
        name: 'Bad',
        price: 5,
        optionGroups: [
          {
            name: 'G',
            required: true,
            minSelect: 3,
            maxSelect: 1,
            choices: [{ name: 'A', priceDelta: 0 }],
          },
        ],
      });
    expect(res.status).toBe(400);
  });
});
