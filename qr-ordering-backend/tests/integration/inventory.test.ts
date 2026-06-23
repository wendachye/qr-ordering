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
  const tables = (await api().get('/admin/tables').set(auth(token))).body.data;
  return { token, mk, code: tables[0].code as string };
}

const itemById = async (token: string, id: string) => {
  const items = (await api().get('/admin/menu/items').set(auth(token))).body.data;
  return items.find((i: { id: string }) => i.id === id);
};

const order = (code: string, menuItemId: string, quantity: number) =>
  api().post('/orders').send({ tableCode: code, items: [{ menuItemId, quantity }] });

describe('item inventory (MVP)', () => {
  it('deducts stock on sale and auto-86s the item at zero', async () => {
    const { token, mk, code } = await ctx();
    const item = await mk('Limited Dish', 12);
    const cfg = await api()
      .patch(`/admin/inventory/${item.id}/config`)
      .set(auth(token))
      .send({ trackStock: true, stockQty: 2, lowStockThreshold: 1 });
    expect(cfg.status).toBe(200);

    expect((await order(code, item.id, 1)).status).toBe(201);
    expect((await itemById(token, item.id)).stockQty).toBe(1);

    expect((await order(code, item.id, 1)).status).toBe(201);
    const sold = await itemById(token, item.id);
    expect(sold.stockQty).toBe(0);
    expect(sold.isAvailable).toBe(false); // auto-86 at zero

    // sold out → further orders rejected
    expect((await order(code, item.id, 1)).status).toBe(400);
  });

  it('rejects an order that exceeds available stock and rolls back', async () => {
    const { token, mk, code } = await ctx();
    const item = await mk('Two Left', 10);
    await api()
      .patch(`/admin/inventory/${item.id}/config`)
      .set(auth(token))
      .send({ trackStock: true, stockQty: 2 });
    const res = await order(code, item.id, 3);
    expect(res.status).toBe(400);
    // stock untouched (whole order rolled back)
    expect((await itemById(token, item.id)).stockQty).toBe(2);
  });

  it('restock re-enables a sold-out item and writes a ledger row', async () => {
    const { token, mk, code } = await ctx();
    const item = await mk('Restockable', 8);
    await api()
      .patch(`/admin/inventory/${item.id}/config`)
      .set(auth(token))
      .send({ trackStock: true, stockQty: 1 });
    await order(code, item.id, 1);
    expect((await itemById(token, item.id)).isAvailable).toBe(false);

    const adj = await api()
      .post(`/admin/inventory/${item.id}/adjust`)
      .set(auth(token))
      .send({ delta: 5, reason: 'restock' });
    expect(adj.status).toBe(200);
    const back = await itemById(token, item.id);
    expect(back.stockQty).toBe(5);
    expect(back.isAvailable).toBe(true);

    const ledger = (await api().get(`/admin/inventory/${item.id}/ledger`).set(auth(token))).body.data;
    expect(ledger.map((r: { reason: string }) => r.reason)).toEqual(
      expect.arrayContaining(['sale', 'restock']),
    );
  });

  it('deducts a combo component from stock', async () => {
    const { token, mk, code } = await ctx();
    const comp = await mk('Combo Comp', 9);
    await api()
      .patch(`/admin/inventory/${comp.id}/config`)
      .set(auth(token))
      .send({ trackStock: true, stockQty: 3 });
    const combo = (
      await api()
        .post('/admin/menu/combos')
        .set(auth(token))
        .send({
          name: 'Combo With Stock',
          price: 15,
          groups: [{ name: 'Main', options: [{ menuItemId: comp.id }] }],
        })
    ).body.data;
    const g = combo.groups[0];
    const res = await api()
      .post('/orders')
      .send({
        tableCode: code,
        items: [
          {
            comboId: combo.id,
            quantity: 2,
            comboSelections: [{ groupId: g.id, optionId: g.options[0].id }],
          },
        ],
      });
    expect(res.status).toBe(201);
    expect((await itemById(token, comp.id)).stockQty).toBe(1); // 3 − 2
  });

  it('restores stock and writes a void_restore row when an item is voided', async () => {
    const { token, mk, code } = await ctx();
    const item = await mk('Voidable', 11);
    await api()
      .patch(`/admin/inventory/${item.id}/config`)
      .set(auth(token))
      .send({ trackStock: true, stockQty: 5 });

    const placed = await order(code, item.id, 2);
    expect(placed.status).toBe(201);
    expect((await itemById(token, item.id)).stockQty).toBe(3); // 5 − 2

    const sessionId = placed.body.data.sessionId as string;
    const session = (await api().get(`/admin/sessions/${sessionId}`).set(auth(token))).body.data;
    const orderItemId = session.rounds[0].items[0].id as string;

    const voided = await api()
      .post(`/admin/orders/items/${orderItemId}/void`)
      .set(auth(token))
      .send({ reason: 'wrong order' });
    expect(voided.status).toBe(200);

    expect((await itemById(token, item.id)).stockQty).toBe(5); // returned to shelf
    const ledger = (await api().get(`/admin/inventory/${item.id}/ledger`).set(auth(token))).body
      .data;
    expect(ledger.map((r: { reason: string }) => r.reason)).toEqual(
      expect.arrayContaining(['sale', 'void_restore']),
    );
  });

  it('un-86s and restores stock when voiding the sale that emptied the shelf', async () => {
    const { token, mk, code } = await ctx();
    const item = await mk('Last One', 9);
    await api()
      .patch(`/admin/inventory/${item.id}/config`)
      .set(auth(token))
      .send({ trackStock: true, stockQty: 1 });
    const placed = await order(code, item.id, 1);
    expect(placed.status).toBe(201);
    expect((await itemById(token, item.id)).isAvailable).toBe(false); // auto-86'd at 0

    const sessionId = placed.body.data.sessionId as string;
    const session = (await api().get(`/admin/sessions/${sessionId}`).set(auth(token))).body.data;
    const orderItemId = session.rounds[0].items[0].id as string;
    await api().post(`/admin/orders/items/${orderItemId}/void`).set(auth(token)).send({});

    const back = await itemById(token, item.id);
    expect(back.stockQty).toBe(1);
    expect(back.isAvailable).toBe(true); // brought back when stock returned > 0
  });

  it('restores stock for tracked items when the whole tab is cancelled', async () => {
    const { token, mk, code } = await ctx();
    const item = await mk('Cancelled Tab Item', 13);
    await api()
      .patch(`/admin/inventory/${item.id}/config`)
      .set(auth(token))
      .send({ trackStock: true, stockQty: 4 });
    const placed = await order(code, item.id, 3);
    expect(placed.status).toBe(201);
    expect((await itemById(token, item.id)).stockQty).toBe(1); // 4 − 3

    const sessionId = placed.body.data.sessionId as string;
    const cancelled = await api()
      .post(`/admin/sessions/${sessionId}/cancel`)
      .set(auth(token))
      .send({});
    expect(cancelled.status).toBe(200);

    expect((await itemById(token, item.id)).stockQty).toBe(4); // returned on cancel
  });

  it('leaves untracked items unlimited', async () => {
    const { token, mk, code } = await ctx();
    const item = await mk('Unlimited', 7);
    // never configured → trackStock false → no deduction, never 86s
    for (let i = 0; i < 5; i++) expect((await order(code, item.id, 9)).status).toBe(201);
    const after = await itemById(token, item.id);
    expect(after.trackStock).toBe(false);
    expect(after.isAvailable).toBe(true);
  });
});
