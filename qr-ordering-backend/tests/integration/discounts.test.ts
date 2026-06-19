import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant, firstOrderable } from '../helpers';

// Helpers: a fresh tenant comes seeded with tables + a menu. Resolve a table
// code and an option-free orderable line (with its unit price) to drive orders.
async function tenantContext() {
  const { data } = await registerTenant();
  const tables = (await api().get('/admin/tables').set(auth(data.token))).body.data;
  const code = tables[0].code as string;
  const menu = (await api().get(`/public/menu?tableCode=${code}`)).body.data;
  const line = firstOrderable(menu);
  const item = menu.categories
    .flatMap((c: any) => c.items)
    .find((i: any) => i.id === line.menuItemId);
  return { token: data.token, code, line, unit: item.price as number };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

describe('discounts — per-line (order entry)', () => {
  it('applies a PERCENT line discount and nets the total', async () => {
    const { token, code, line, unit } = await tenantContext();
    const res = await api()
      .post('/admin/orders')
      .set(auth(token))
      .send({
        tableCode: code,
        items: [{ ...line, quantity: 2, discountType: 'PERCENT', discountValue: 10 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBeCloseTo(round2(unit * 2 * 0.9), 2);
  });

  it('caps a FIXED line discount at the line value (never negative)', async () => {
    const { token, code, line, unit } = await tenantContext();
    const res = await api()
      .post('/admin/orders')
      .set(auth(token))
      .send({
        tableCode: code,
        items: [{ ...line, quantity: 1, discountType: 'FIXED', discountValue: unit + 999 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(0); // discounted to zero, not below
  });

  it('a public (non-admin) order ignores any discount fields', async () => {
    const { code, line } = await tenantContext();
    const menu = (await api().get(`/public/menu?tableCode=${code}`)).body.data;
    const item = menu.categories
      .flatMap((c: any) => c.items)
      .find((i: any) => i.id === line.menuItemId);
    const res = await api()
      .post('/orders')
      .send({
        tableCode: code,
        items: [{ ...line, quantity: 1, discountType: 'PERCENT', discountValue: 50 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBeCloseTo(item.price, 2); // full price, discount not honoured
  });

  it('rejects a discount type without a value', async () => {
    const { token, code, line } = await tenantContext();
    const res = await api()
      .post('/admin/orders')
      .set(auth(token))
      .send({ tableCode: code, items: [{ ...line, discountType: 'PERCENT' }] });
    expect(res.status).toBe(400);
  });

  it('rejects a percentage over 100', async () => {
    const { token, code, line } = await tenantContext();
    const res = await api()
      .post('/admin/orders')
      .set(auth(token))
      .send({ tableCode: code, items: [{ ...line, discountType: 'PERCENT', discountValue: 150 }] });
    expect(res.status).toBe(400);
  });
});

describe('discounts — bill level (at settlement)', () => {
  it('applies a FIXED bill discount and reports the net', async () => {
    const { token, code, line, unit } = await tenantContext();
    const order = await api()
      .post('/admin/orders')
      .set(auth(token))
      .send({ tableCode: code, items: [{ ...line, quantity: 3 }] });
    expect(order.status).toBe(201);
    const sessionId = order.body.data.sessionId;
    const gross = round2(unit * 3);

    const closed = await api()
      .post(`/admin/sessions/${sessionId}/close`)
      .set(auth(token))
      .send({ paymentMethod: 'Cash', discountType: 'FIXED', discountValue: 5 });
    expect(closed.status).toBe(200);
    expect(closed.body.data.discount).toBeCloseTo(5, 2);
    expect(closed.body.data.total).toBeCloseTo(gross, 2);
    expect(closed.body.data.netTotal).toBeCloseTo(round2(gross - 5), 2);
  });

  it('reflects a PERCENT bill discount in the daily report (net reconciles)', async () => {
    const { token, code, line, unit } = await tenantContext();
    const order = await api()
      .post('/admin/orders')
      .set(auth(token))
      .send({ tableCode: code, items: [{ ...line, quantity: 4 }] });
    const sessionId = order.body.data.sessionId;
    const gross = round2(unit * 4);

    await api()
      .post(`/admin/sessions/${sessionId}/close`)
      .set(auth(token))
      .send({ paymentMethod: 'Card', discountType: 'PERCENT', discountValue: 20 });

    const report = (await api().get('/admin/reports/sales').set(auth(token))).body.data;
    const s = report.sales;
    expect(s.grossSales).toBeCloseTo(gross, 2);
    expect(s.billDiscounts).toBeCloseTo(round2(gross * 0.2), 2);
    expect(s.netSales).toBeCloseTo(round2(gross * 0.8), 2);
    // Payments reconcile to net sales.
    const paid = report.byPayment.reduce((sum: number, p: any) => sum + p.amount, 0);
    expect(round2(paid)).toBeCloseTo(s.netSales, 2);
  });
});

describe('discounts — edge cases & integrity', () => {
  it('rounds a >2dp price override so the line reconciles at 2dp', async () => {
    const { token, code, line } = await tenantContext();
    const res = await api()
      .post('/admin/orders')
      .set(auth(token))
      .send({ tableCode: code, items: [{ ...line, quantity: 1, priceOverride: 3.999 }] });
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(4); // 3.999 -> 4.00, reconciles exactly
  });

  it('clears a settled bill discount when the tab is re-opened', async () => {
    const { token, code, line, unit } = await tenantContext();
    const order = await api()
      .post('/admin/orders')
      .set(auth(token))
      .send({ tableCode: code, items: [{ ...line, quantity: 1 }] });
    const sessionId = order.body.data.sessionId;
    await api()
      .post(`/admin/sessions/${sessionId}/close`)
      .set(auth(token))
      .send({ paymentMethod: 'Cash', discountType: 'FIXED', discountValue: 5 });

    const reopened = await api().post(`/admin/sessions/${sessionId}/reopen`).set(auth(token));
    expect(reopened.status).toBe(200);
    // The previously-settled discount must not bleed into the re-opened tab.
    expect(reopened.body.data.discount).toBe(0);
    expect(reopened.body.data.discountType).toBeNull();
    expect(reopened.body.data.netTotal).toBeCloseTo(unit, 2);
  });
});

describe('PIN-requirement settings (discount + override)', () => {
  it('discounts + overrides default to requiring the PIN and can be turned off', async () => {
    const { data } = await registerTenant();
    const settings = (await api().get('/admin/settings').set(auth(data.token))).body.data;
    expect(settings.discountPinRequired).toBe(true);
    expect(settings.overridePinRequired).toBe(true);

    const off = await api()
      .patch('/admin/settings')
      .set(auth(data.token))
      .send({ discountPinRequired: false, overridePinRequired: false });
    expect(off.status).toBe(200);
    expect(off.body.data.discountPinRequired).toBe(false);
    expect(off.body.data.overridePinRequired).toBe(false);
  });

  it("can't require a PIN (discount or override) before an override PIN exists", async () => {
    const { data } = await registerTenant();
    const d = await api()
      .patch('/admin/settings')
      .set(auth(data.token))
      .send({ discountPinRequired: true });
    expect(d.status).toBe(400);

    const o = await api()
      .patch('/admin/settings')
      .set(auth(data.token))
      .send({ overridePinRequired: true });
    expect(o.status).toBe(400);
  });
});
