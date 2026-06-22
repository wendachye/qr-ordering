import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant, firstOrderable } from '../helpers';

const round2 = (n: number) => Math.round(n * 100) / 100;

// A fresh tenant is seeded with tables + a menu. Resolve a table code and an
// option-free orderable line with its unit price to drive settlement.
async function ctx() {
  const { data } = await registerTenant();
  const token = data.token as string;
  const tables = (await api().get('/admin/tables').set(auth(token))).body.data;
  const code = tables[0].code as string;
  const menu = (await api().get(`/public/menu?tableCode=${code}`)).body.data;
  const line = firstOrderable(menu);
  const item = menu.categories
    .flatMap((c: any) => c.items)
    .find((i: any) => i.id === line.menuItemId);
  return { token, code, line, unit: item.price as number };
}

async function openTab(token: string, code: string, line: any, quantity: number) {
  const order = await api()
    .post('/admin/orders')
    .set(auth(token))
    .send({ tableCode: code, items: [{ ...line, quantity }] });
  expect(order.status).toBe(201);
  return order.body.data.sessionId as string;
}

describe('payments — tender ledger (A1)', () => {
  it('records a single full-amount Payment when a tab is settled', async () => {
    const { token, code, line, unit } = await ctx();
    const sessionId = await openTab(token, code, line, 2);
    const net = round2(unit * 2);

    const closed = await api()
      .post(`/admin/sessions/${sessionId}/close`)
      .set(auth(token))
      .send({ paymentMethod: 'Cash' });
    expect(closed.status).toBe(200);

    const s = closed.body.data;
    expect(s.payments).toHaveLength(1);
    expect(s.payments[0].method).toBe('Cash');
    expect(s.payments[0].amount).toBeCloseTo(net, 2);
    expect(s.payments[0].tip).toBe(0);
    expect(s.amountPaid).toBeCloseTo(net, 2);
    expect(s.tipTotal).toBe(0);
    expect(s.balanceDue).toBeCloseTo(0, 2);
  });

  it('the recorded payment pays the net (after a bill discount), not the gross', async () => {
    const { token, code, line, unit } = await ctx();
    const sessionId = await openTab(token, code, line, 4);
    const gross = round2(unit * 4);

    const closed = await api()
      .post(`/admin/sessions/${sessionId}/close`)
      .set(auth(token))
      .send({ paymentMethod: 'Card', discountType: 'PERCENT', discountValue: 25 });
    const s = closed.body.data;

    expect(s.netTotal).toBeCloseTo(round2(gross * 0.75), 2);
    expect(s.payments).toHaveLength(1);
    expect(s.amountPaid).toBeCloseTo(s.netTotal, 2);
    expect(s.balanceDue).toBeCloseTo(0, 2);
  });

  it('clears the tender ledger when a tab is re-opened', async () => {
    const { token, code, line, unit } = await ctx();
    const sessionId = await openTab(token, code, line, 1);
    await api()
      .post(`/admin/sessions/${sessionId}/close`)
      .set(auth(token))
      .send({ paymentMethod: 'Cash' });

    const reopened = await api().post(`/admin/sessions/${sessionId}/reopen`).set(auth(token));
    expect(reopened.status).toBe(200);
    const s = reopened.body.data;
    expect(s.payments).toHaveLength(0);
    expect(s.amountPaid).toBe(0);
    expect(s.balanceDue).toBeCloseTo(unit, 2);
  });
});

describe('payments — tipping (A2)', () => {
  it('records a tip on the payment, separate from the amount paid toward the bill', async () => {
    const { token, code, line, unit } = await ctx();
    const sessionId = await openTab(token, code, line, 2);
    const net = round2(unit * 2);

    const closed = await api()
      .post(`/admin/sessions/${sessionId}/close`)
      .set(auth(token))
      .send({ paymentMethod: 'Card', tip: 3 });
    expect(closed.status).toBe(200);

    const s = closed.body.data;
    expect(s.payments).toHaveLength(1);
    expect(s.payments[0].tip).toBeCloseTo(3, 2);
    expect(s.payments[0].amount).toBeCloseTo(net, 2); // tip is on top, not part of amount
    expect(s.tipTotal).toBeCloseTo(3, 2);
    expect(s.amountPaid).toBeCloseTo(net, 2);
    expect(s.balanceDue).toBeCloseTo(0, 2);
  });

  it('reports tips separately from net sales (drawer = net sales + tips)', async () => {
    const { token, code, line } = await ctx();
    const sessionId = await openTab(token, code, line, 1);
    await api()
      .post(`/admin/sessions/${sessionId}/close`)
      .set(auth(token))
      .send({ paymentMethod: 'Cash', tip: 2 });

    const report = (await api().get('/admin/reports/sales').set(auth(token))).body.data;
    expect(report.sales.tips).toBeCloseTo(2, 2);
    // Tips don't inflate sales; the drawer total does include them.
    expect(round2(report.sales.grandTotalCollected)).toBeCloseTo(
      round2(report.sales.netSales + report.sales.tips),
      2,
    );
  });
});

describe('payments — split / partial (A3)', () => {
  it('a partial tender keeps the tab OPEN with the remaining balance owing', async () => {
    const { token, code, line, unit } = await ctx();
    const sessionId = await openTab(token, code, line, 3);
    const net = round2(unit * 3);
    const half = round2(net / 2);

    const part = await api()
      .post(`/admin/sessions/${sessionId}/pay`)
      .set(auth(token))
      .send({ paymentMethod: 'Cash', amount: half });
    expect(part.status).toBe(200);

    const s = part.body.data;
    expect(s.status).toBe('OPEN');
    expect(s.payments).toHaveLength(1);
    expect(s.amountPaid).toBeCloseTo(half, 2);
    expect(s.balanceDue).toBeCloseTo(round2(net - half), 2);
  });

  it('settles a split tab across two methods and marks it Split', async () => {
    const { token, code, line, unit } = await ctx();
    const sessionId = await openTab(token, code, line, 4);
    const net = round2(unit * 4);
    const first = round2(net / 4);

    await api()
      .post(`/admin/sessions/${sessionId}/pay`)
      .set(auth(token))
      .send({ paymentMethod: 'Cash', amount: first });
    // No amount on the 2nd tender → settle the remaining balance in full.
    const done = await api()
      .post(`/admin/sessions/${sessionId}/pay`)
      .set(auth(token))
      .send({ paymentMethod: 'Visa' });

    const s = done.body.data;
    expect(s.status).toBe('CLOSED');
    expect(s.paymentMethod).toBe('Split');
    expect(s.payments).toHaveLength(2);
    expect(s.amountPaid).toBeCloseTo(net, 2);
    expect(s.balanceDue).toBeCloseTo(0, 2);
  });

  it('caps a tender at the outstanding balance (cash overpay is change, not bill)', async () => {
    const { token, code, line, unit } = await ctx();
    const sessionId = await openTab(token, code, line, 1);
    const net = round2(unit);

    const done = await api()
      .post(`/admin/sessions/${sessionId}/pay`)
      .set(auth(token))
      .send({ paymentMethod: 'Cash', amount: net + 50, tendered: net + 50 });

    const s = done.body.data;
    expect(s.status).toBe('CLOSED');
    expect(s.payments[0].amount).toBeCloseTo(net, 2); // capped at the balance
    expect(s.payments[0].tendered).toBeCloseTo(net + 50, 2);
    expect(s.amountPaid).toBeCloseTo(net, 2);
  });

  it('locks a bill discount on the first tender; a later tender cannot change it', async () => {
    const { token, code, line, unit } = await ctx();
    const sessionId = await openTab(token, code, line, 4);
    const gross = round2(unit * 4);
    const net = round2(gross * 0.75);

    // First tender applies a 25% discount + pays RM10.
    const part = await api()
      .post(`/admin/sessions/${sessionId}/pay`)
      .set(auth(token))
      .send({ paymentMethod: 'Cash', amount: 10, discountType: 'PERCENT', discountValue: 25 });
    expect(part.body.data.netTotal).toBeCloseTo(net, 2);
    expect(part.body.data.balanceDue).toBeCloseTo(round2(net - 10), 2);

    // Second tender tries a steeper discount — ignored; settles the locked net.
    const done = await api()
      .post(`/admin/sessions/${sessionId}/pay`)
      .set(auth(token))
      .send({ paymentMethod: 'Cash', discountType: 'PERCENT', discountValue: 90 });
    const s = done.body.data;
    expect(s.status).toBe('CLOSED');
    expect(s.netTotal).toBeCloseTo(net, 2); // still 25%, not 90%
    expect(s.amountPaid).toBeCloseTo(net, 2);
  });

  it('shows a part-paid tab’s paid + balance on the floor', async () => {
    const { token, code, line, unit } = await ctx();
    const sessionId = await openTab(token, code, line, 2);
    const net = round2(unit * 2);
    const half = round2(net / 2);
    await api()
      .post(`/admin/sessions/${sessionId}/pay`)
      .set(auth(token))
      .send({ paymentMethod: 'Cash', amount: half });

    const floor = (await api().get('/admin/floor').set(auth(token))).body.data;
    const entry = floor.find((e: any) => e.session && e.session.id === sessionId);
    expect(entry).toBeTruthy();
    expect(entry.session.amountPaid).toBeCloseTo(half, 2);
    expect(entry.session.balanceDue).toBeCloseTo(round2(net - half), 2);
  });
});

describe('payments — diner receipt (A4)', () => {
  it('serves a public receipt for a settled tab with the bill breakdown', async () => {
    const { token, code, line, unit } = await ctx();
    const sessionId = await openTab(token, code, line, 2);
    const net = round2(unit * 2);
    await api()
      .post(`/admin/sessions/${sessionId}/pay`)
      .set(auth(token))
      .send({ paymentMethod: 'Cash', tip: 4, tendered: net + 4 });

    // Public — no auth header.
    const res = await api().get(`/public/receipt/${sessionId}`);
    expect(res.status).toBe(200);
    const r = res.body.data;
    expect(r.net).toBeCloseTo(net, 2);
    expect(r.tip).toBeCloseTo(4, 2);
    expect(r.total).toBeCloseTo(round2(net + 4), 2);
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.payments).toHaveLength(1);
    expect(r.payments[0].method).toBe('Cash');
    // Tax-inclusive decomposition reconciles back to the net.
    expect(round2(r.subtotal + r.serviceCharge + r.totalTax)).toBeCloseTo(net, 2);
  });

  it('404s the receipt while the tab is still open', async () => {
    const { token, code, line } = await ctx();
    const sessionId = await openTab(token, code, line, 1);
    const res = await api().get(`/public/receipt/${sessionId}`);
    expect(res.status).toBe(404);
  });
});
