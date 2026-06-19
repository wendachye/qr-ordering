import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant } from '../helpers';

async function ctx() {
  const { data } = await registerTenant();
  const token = data.token as string;
  const tables = (await api().get('/admin/tables').set(auth(token))).body.data;
  return { token, code: tables[0].code as string };
}

describe('custom (open) order items', () => {
  it('adds a custom item with a name + price (no backing menu item)', async () => {
    const { token, code } = await ctx();
    const res = await api()
      .post('/admin/orders')
      .set(auth(token))
      .send({
        tableCode: code,
        items: [{ customName: 'Birthday cake (outside)', customPrice: 25, quantity: 2 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBeCloseTo(50, 2);

    const sid = res.body.data.sessionId as string;
    const session = (await api().get(`/admin/sessions/${sid}`).set(auth(token))).body.data;
    const item = session.rounds
      .flatMap((r: any) => r.items)
      .find((i: any) => i.name === 'Birthday cake (outside)');
    expect(item).toBeTruthy();
    expect(item.menuItemId).toBeNull();
    expect(item.unitPrice).toBeCloseTo(25, 2);
    expect(item.totalPrice).toBeCloseTo(50, 2);
  });

  it('mixes a menu item and a custom item on one order', async () => {
    const { token, code } = await ctx();
    const menu = (await api().get(`/public/menu?tableCode=${code}`)).body.data;
    const m = menu.categories
      .flatMap((c: any) => c.items)
      .find((i: any) => i.isAvailable && !(i.optionGroups ?? []).some((g: any) => g.required));
    const res = await api()
      .post('/admin/orders')
      .set(auth(token))
      .send({
        tableCode: code,
        items: [
          { menuItemId: m.id, quantity: 1, optionChoiceIds: [] },
          { customName: 'Corkage', customPrice: 30, quantity: 1 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBeCloseTo(m.price + 30, 2);
  });

  it('rejects a line with neither a menu item nor a custom name', async () => {
    const { token, code } = await ctx();
    const res = await api()
      .post('/admin/orders')
      .set(auth(token))
      .send({ tableCode: code, items: [{ quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  it('rejects a custom item without a price', async () => {
    const { token, code } = await ctx();
    const res = await api()
      .post('/admin/orders')
      .set(auth(token))
      .send({ tableCode: code, items: [{ customName: 'No price', quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  it('a public (customer) order cannot add a custom item', async () => {
    const { code } = await ctx();
    const res = await api()
      .post('/orders')
      .send({ tableCode: code, items: [{ customName: 'Sneaky', customPrice: 5, quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  it('buckets a settled custom item under "Custom items" in the report', async () => {
    const { token, code } = await ctx();
    const order = await api()
      .post('/admin/orders')
      .set(auth(token))
      .send({ tableCode: code, items: [{ customName: 'Corkage', customPrice: 30, quantity: 1 }] });
    await api()
      .post(`/admin/sessions/${order.body.data.sessionId}/close`)
      .set(auth(token))
      .send({ paymentMethod: 'Cash' });
    const report = (await api().get('/admin/reports/sales').set(auth(token))).body.data;
    expect(report.sales.netSales).toBeCloseTo(30, 2);
    expect(report.byCategory.some((c: any) => c.category === 'Custom items')).toBe(true);
  });
});
