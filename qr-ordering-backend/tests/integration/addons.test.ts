import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant } from '../helpers';

async function ctx() {
  const { data } = await registerTenant();
  const token = data.token as string;
  const tables = (await api().get('/admin/tables').set(auth(token))).body.data;
  const code = tables[0].code as string;
  const menu = (await api().get(`/public/menu?tableCode=${code}`)).body.data;
  // A plain item: available, no required options, no standing menu discount.
  const item = menu.categories
    .flatMap((c: any) => c.items)
    .find(
      (i: any) =>
        i.isAvailable && !(i.optionGroups ?? []).some((g: any) => g.required) && !i.salePrice,
    );
  return { token, code, item };
}

describe('custom add-ons (special requests with a price)', () => {
  it('adds priced add-ons to a menu-item line and folds them into the price', async () => {
    const { token, code, item } = await ctx();
    const res = await api()
      .post('/admin/orders')
      .set(auth(token))
      .send({
        tableCode: code,
        items: [
          {
            menuItemId: item.id,
            quantity: 1,
            optionChoiceIds: [],
            addons: [
              { name: 'Add 2 eggs', price: 2 },
              { name: 'Extra vegetables', price: 1.5 },
            ],
          },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBeCloseTo(item.price + 3.5, 2);

    const sid = res.body.data.sessionId as string;
    const session = (await api().get(`/admin/sessions/${sid}`).set(auth(token))).body.data;
    const line = session.rounds
      .flatMap((r: any) => r.items)
      .find((i: any) => i.menuItemId === item.id);
    expect(line.unitPrice).toBeCloseTo(item.price + 3.5, 2);
    expect(line.totalPrice).toBeCloseTo(item.price + 3.5, 2);
    const addonOpts = line.selectedOptions.filter((o: any) => o.group === 'Add-on');
    expect(addonOpts.map((o: any) => o.choice)).toEqual(['Add 2 eggs', 'Extra vegetables']);
    expect(addonOpts.find((o: any) => o.choice === 'Add 2 eggs').priceDelta).toBeCloseTo(2, 2);
  });

  it('multiplies add-ons by quantity', async () => {
    const { token, code, item } = await ctx();
    const res = await api()
      .post('/admin/orders')
      .set(auth(token))
      .send({
        tableCode: code,
        items: [
          {
            menuItemId: item.id,
            quantity: 3,
            optionChoiceIds: [],
            addons: [{ name: 'Add egg', price: 2 }],
          },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBeCloseTo((item.price + 2) * 3, 2);
  });

  it('records a free (RM0) add-on as a special request with no charge', async () => {
    const { token, code, item } = await ctx();
    const res = await api()
      .post('/admin/orders')
      .set(auth(token))
      .send({
        tableCode: code,
        items: [
          {
            menuItemId: item.id,
            quantity: 1,
            optionChoiceIds: [],
            addons: [{ name: 'No onion please', price: 0 }],
          },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBeCloseTo(item.price, 2);
    const sid = res.body.data.sessionId as string;
    const session = (await api().get(`/admin/sessions/${sid}`).set(auth(token))).body.data;
    const line = session.rounds
      .flatMap((r: any) => r.items)
      .find((i: any) => i.menuItemId === item.id);
    expect(
      line.selectedOptions.some((o: any) => o.group === 'Add-on' && o.choice === 'No onion please'),
    ).toBe(true);
  });

  it('a public (customer) order cannot add custom add-ons', async () => {
    const { code, item } = await ctx();
    const res = await api()
      .post('/orders')
      .send({
        tableCode: code,
        items: [
          {
            menuItemId: item.id,
            quantity: 1,
            optionChoiceIds: [],
            addons: [{ name: 'Sneaky charge', price: 5 }],
          },
        ],
      });
    // The public schema has no `addons` field (stripped) and the service only
    // applies add-ons for admin requests, so the bill stays at the base price.
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBeCloseTo(item.price, 2);
  });
});
