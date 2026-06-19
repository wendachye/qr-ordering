import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant } from '../helpers';

describe('POS-only ("secret") menu item', () => {
  it('hides a POS-only item from the customer menu but shows it (flagged) in the POS menu', async () => {
    const { data } = await registerTenant();
    const token = data.token;

    const cats = (await api().get('/admin/menu/categories').set(auth(token))).body.data;
    const categoryId = cats[0].id;

    // A secret (POS-only) item + a normal customer-visible one.
    const secret = await api()
      .post('/admin/menu/items')
      .set(auth(token))
      .send({ categoryId, name: 'Staff Special', price: 9.9, posOnly: true });
    expect([200, 201]).toContain(secret.status);
    expect(secret.body.data.posOnly).toBe(true);
    const secretId = secret.body.data.id as string;

    const normal = await api()
      .post('/admin/menu/items')
      .set(auth(token))
      .send({ categoryId, name: 'Normal Dish', price: 5 });
    const normalId = normal.body.data.id as string;
    expect(normal.body.data.posOnly).toBe(false);

    const tables = (await api().get('/admin/tables').set(auth(token))).body.data;
    const code = tables[0].code;

    // Customer menu: secret hidden, normal visible.
    const publicMenu = (await api().get(`/public/menu?tableCode=${code}`)).body.data;
    const publicIds = publicMenu.categories.flatMap((c: any) => c.items).map((i: any) => i.id);
    expect(publicIds).toContain(normalId);
    expect(publicIds).not.toContain(secretId);

    // POS menu: both present; the secret one is flagged posOnly.
    const posMenu = (await api().get(`/admin/menu/pos-menu?tableCode=${code}`).set(auth(token)))
      .body.data;
    const posItems = posMenu.categories.flatMap((c: any) => c.items);
    const posIds = posItems.map((i: any) => i.id);
    expect(posIds).toContain(normalId);
    expect(posIds).toContain(secretId);
    expect(posItems.find((i: any) => i.id === secretId)?.posOnly).toBe(true);
    expect(posItems.find((i: any) => i.id === normalId)?.posOnly).toBe(false);
  });

  it('keeps a POS-only item out of the public featured strip', async () => {
    const { data } = await registerTenant();
    const token = data.token;
    const cats = (await api().get('/admin/menu/categories').set(auth(token))).body.data;
    const created = await api()
      .post('/admin/menu/items')
      .set(auth(token))
      .send({ categoryId: cats[0].id, name: 'Secret Feature', price: 12, posOnly: true });
    const id = created.body.data.id as string;
    await api()
      .patch(`/admin/menu/items/${id}/feature`)
      .set(auth(token))
      .send({ isFeatured: true });

    const tables = (await api().get('/admin/tables').set(auth(token))).body.data;
    const code = tables[0].code;
    const publicMenu = (await api().get(`/public/menu?tableCode=${code}`)).body.data;
    const featuredIds = (publicMenu.featured ?? []).map((i: any) => i.id);
    expect(featuredIds).not.toContain(id);
  });
});
