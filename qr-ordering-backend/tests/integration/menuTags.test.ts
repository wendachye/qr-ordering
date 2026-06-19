import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant } from '../helpers';

describe('menu item tags', () => {
  it('round-trips tags on create + update and exposes them on the public menu', async () => {
    const { data } = await registerTenant();
    const token = data.token;

    const cats = (await api().get('/admin/menu/categories').set(auth(token))).body.data;
    const categoryId = cats[0].id;

    // Create with tags.
    const created = await api()
      .post('/admin/menu/items')
      .set(auth(token))
      .send({ categoryId, name: 'Tag Test Dish', price: 12.5, tags: ['Spicy', 'Halal'] });
    expect([200, 201]).toContain(created.status);
    expect(created.body.data.tags).toEqual(['Spicy', 'Halal']);
    const id = created.body.data.id as string;

    // Update tags.
    const updated = await api()
      .patch(`/admin/menu/items/${id}`)
      .set(auth(token))
      .send({ tags: ['Vegetarian'] });
    expect(updated.status).toBe(200);
    expect(updated.body.data.tags).toEqual(['Vegetarian']);

    // Exposed on the customer-facing public menu.
    const tables = (await api().get('/admin/tables').set(auth(token))).body.data;
    const code = tables[0].code;
    const menu = (await api().get(`/public/menu?tableCode=${code}`)).body.data;
    const found = menu.categories.flatMap((c: any) => c.items).find((i: any) => i.id === id);
    expect(found?.tags).toEqual(['Vegetarian']);
  });

  it('rejects more than 8 tags', async () => {
    const { data } = await registerTenant();
    const cats = (await api().get('/admin/menu/categories').set(auth(data.token))).body.data;
    const res = await api()
      .post('/admin/menu/items')
      .set(auth(data.token))
      .send({
        categoryId: cats[0].id,
        name: 'Too Many Tags',
        price: 5,
        tags: Array.from({ length: 9 }, (_, i) => `t${i}`),
      });
    expect(res.status).toBe(400);
  });
});
