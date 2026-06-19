import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant, firstOrderable } from '../helpers';

const round2 = (n: number) => Math.round(n * 100) / 100;

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}
function shift(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const nd = new Date(y, m - 1, d + delta);
  return `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-${String(
    nd.getDate(),
  ).padStart(2, '0')}`;
}

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

async function settle(token: string, code: string, items: any[], paymentMethod = 'Cash') {
  const order = await api().post('/admin/orders').set(auth(token)).send({ tableCode: code, items });
  const sessionId = order.body.data.sessionId as string;
  const closed = await api()
    .post(`/admin/sessions/${sessionId}/close`)
    .set(auth(token))
    .send({ paymentMethod });
  return { sessionId, order, closed };
}

const sales = (token: string, q = '') =>
  api()
    .get(`/admin/reports/sales${q}`)
    .set(auth(token))
    .then((r) => r.body.data);

describe('sales report — service charge & tax back-out (inclusive)', () => {
  it('decomposes the collected net into subtotal + service charge + tax', async () => {
    const { token, code, line, unit } = await ctx();
    await api()
      .patch('/admin/settings')
      .set(auth(token))
      .send({ serviceChargeRate: 10, taxes: [{ name: 'SST', rate: 6 }] });
    await settle(token, code, [{ ...line, quantity: 2 }]);
    const net = round2(unit * 2);

    const report = await sales(token);
    const s = report.sales;
    expect(report.charges.serviceChargeRate).toBe(10);
    expect(report.charges.taxes).toEqual([{ name: 'SST', rate: 6 }]);
    expect(s.netSales).toBeCloseTo(net, 2);

    // Inclusive back-out: base2 (subtotal+SC) = net / (1 + 0.06).
    const base2 = net / 1.06;
    expect(s.taxes).toHaveLength(1);
    expect(s.taxes[0].name).toBe('SST');
    expect(s.taxes[0].amount).toBeCloseTo(round2(base2 * 0.06), 2);
    expect(s.serviceCharge).toBeCloseTo(round2((base2 / 1.1) * 0.1), 2);
    // Components reconcile exactly to the collected net.
    expect(round2(s.subtotalExCharges + s.serviceCharge + s.totalTax)).toBe(net);
    expect(s.totalCollected).toBeCloseTo(net, 2);
  });

  it('supports multiple taxes (SST + GST) that sum correctly', async () => {
    const { token, code, line, unit } = await ctx();
    await api()
      .patch('/admin/settings')
      .set(auth(token))
      .send({
        taxes: [
          { name: 'SST', rate: 6 },
          { name: 'GST', rate: 4 },
        ],
      });
    await settle(token, code, [{ ...line, quantity: 1 }]);
    const net = round2(unit);

    const report = await sales(token);
    const s = report.sales;
    expect(s.taxes.map((t: any) => t.name)).toEqual(['SST', 'GST']);
    // No service charge → base2 == subtotal == net / (1 + 0.10).
    const base2 = net / 1.1;
    expect(s.taxes[0].amount).toBeCloseTo(round2(base2 * 0.06), 2);
    expect(s.taxes[1].amount).toBeCloseTo(round2(base2 * 0.04), 2);
    expect(round2(s.subtotalExCharges + s.serviceCharge + s.totalTax)).toBe(net);
  });

  it('hides the breakdown when no service charge / tax is set', async () => {
    const { token, code, line } = await ctx();
    await settle(token, code, [{ ...line, quantity: 1 }]);
    const report = await sales(token);
    expect(report.charges.serviceChargeRate).toBe(0);
    expect(report.charges.taxes).toEqual([]);
    expect(report.sales.serviceCharge).toBe(0);
    expect(report.sales.taxes).toEqual([]);
    expect(report.sales.totalTax).toBe(0);
    expect(report.sales.subtotalExCharges).toBeCloseTo(report.sales.netSales, 2);
  });
});

describe('sales report — channels, tender, dayparts', () => {
  it('splits revenue into dine-in and takeaway channels', async () => {
    const { token, code, line, unit } = await ctx();
    await settle(token, code, [
      { ...line, quantity: 2 },
      { ...line, quantity: 1, isTakeaway: true, applyTakeawayCharge: false },
    ]);
    const report = await sales(token);
    expect(report.channels.dineIn.items).toBe(2);
    expect(report.channels.takeaway.items).toBe(1);
    expect(report.channels.dineIn.revenue).toBeCloseTo(round2(unit * 2), 2);
    expect(report.channels.takeaway.revenue).toBeCloseTo(round2(unit), 2);
  });

  it('channel revenue reconciles to net sales even with a bill discount', async () => {
    const { token, code, line, unit } = await ctx();
    const order = await api()
      .post('/admin/orders')
      .set(auth(token))
      .send({
        tableCode: code,
        items: [
          { ...line, quantity: 2 },
          { ...line, quantity: 1, isTakeaway: true, applyTakeawayCharge: false },
        ],
      });
    const sid = order.body.data.sessionId as string;
    await api()
      .post(`/admin/sessions/${sid}/close`)
      .set(auth(token))
      .send({ paymentMethod: 'Cash', discountType: 'FIXED', discountValue: 5 });
    const report = await sales(token);
    const channelTotal = report.channels.dineIn.revenue + report.channels.takeaway.revenue;
    expect(round2(channelTotal)).toBeCloseTo(report.sales.netSales, 2);
    expect(report.sales.netSales).toBeCloseTo(round2(unit * 3 - 5), 2);
  });

  it('reconciles tender by method and reports a percentage of net', async () => {
    const { token, code, line, unit } = await ctx();
    await settle(token, code, [{ ...line, quantity: 1 }], 'Cash');
    await settle(token, code, [{ ...line, quantity: 1 }], 'Visa');
    const report = await sales(token);
    const paid = report.byPayment.reduce((sum: number, p: any) => sum + p.amount, 0);
    expect(round2(paid)).toBeCloseTo(report.sales.netSales, 2);
    expect(round2(report.sales.netSales)).toBeCloseTo(round2(unit * 2), 2);
    const pctSum = report.byPayment.reduce((sum: number, p: any) => sum + p.pct, 0);
    expect(pctSum).toBeGreaterThan(99);
    expect(pctSum).toBeLessThan(101);
  });

  it('daypart revenue sums to net sales', async () => {
    const { token, code, line, unit } = await ctx();
    await settle(token, code, [{ ...line, quantity: 3 }]);
    const report = await sales(token);
    const dpTotal = report.dayparts.reduce((sum: number, d: any) => sum + d.revenue, 0);
    expect(round2(dpTotal)).toBeCloseTo(round2(unit * 3), 2);
  });
});

describe('sales report — periods & series', () => {
  it('returns a single-day Z reading with a one-entry series', async () => {
    const { token, code, line, unit } = await ctx();
    await settle(token, code, [{ ...line, quantity: 1 }]);
    const t = today();
    const report = await sales(token, `?from=${t}&to=${t}`);
    expect(report.period.kind).toBe('day');
    expect(report.period.from).toBe(t);
    expect(report.period.to).toBe(t);
    expect(report.period.days).toBe(1);
    expect(report.series).toHaveLength(1);
    expect(report.series[0].date).toBe(t);
    expect(report.series[0].netSales).toBeCloseTo(round2(unit), 2);
  });

  it('per-day series gross reconciles to the headline pre-discount gross', async () => {
    const { token, code, line, unit } = await ctx();
    // An admin line discount records an OrderItem discount, so gross != net.
    await settle(token, code, [
      { ...line, quantity: 2, discountType: 'PERCENT', discountValue: 50 },
    ]);
    const report = await sales(token);
    const seriesGross = report.series.reduce((a: number, d: any) => a + d.grossSales, 0);
    expect(round2(seriesGross)).toBeCloseTo(report.sales.grossSales, 2);
    expect(report.sales.grossSales).toBeCloseTo(round2(unit * 2), 2); // pre-discount
    expect(report.sales.netSales).toBeCloseTo(round2(unit), 2); // 50% off the line
  });

  it('aggregates a multi-day range and still finds today', async () => {
    const { token, code, line, unit } = await ctx();
    await settle(token, code, [{ ...line, quantity: 2 }]);
    const t = today();
    const report = await sales(token, `?from=${shift(t, -2)}&to=${t}`);
    expect(report.period.days).toBe(3);
    expect(report.period.kind).toBe('range');
    const todayEntry = report.series.find((d: any) => d.date === t);
    expect(todayEntry).toBeTruthy();
    expect(todayEntry.netSales).toBeCloseTo(round2(unit * 2), 2);
    expect(report.sales.netSales).toBeCloseTo(round2(unit * 2), 2);
  });
});

describe('sales report — voids', () => {
  it('reports cancelled tabs separately and excludes them from sales', async () => {
    const { token, code, line, unit } = await ctx();
    const order = await api()
      .post('/admin/orders')
      .set(auth(token))
      .send({ tableCode: code, items: [{ ...line, quantity: 2 }] });
    const sessionId = order.body.data.sessionId as string;
    const cancelled = await api()
      .post(`/admin/sessions/${sessionId}/cancel`)
      .set(auth(token))
      .send({ reason: 'test void' });
    expect(cancelled.status).toBe(200);

    const report = await sales(token);
    expect(report.voids.tabs.count).toBe(1);
    expect(report.voids.tabs.amount).toBeCloseTo(round2(unit * 2), 2);
    expect(report.sales.netSales).toBe(0);
    expect(report.counts.tabsSettled).toBe(0);
  });
});
