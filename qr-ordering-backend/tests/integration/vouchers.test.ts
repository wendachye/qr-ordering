import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant, firstOrderable } from '../helpers';

const round2 = (n: number) => Math.round(n * 100) / 100;

async function ctx() {
  const { data } = await registerTenant();
  const token = data.token as string;
  const tables = (await api().get('/api/admin/tables').set(auth(token))).body.data;
  const code = tables[0].code as string;
  const menu = (await api().get(`/api/public/menu?tableCode=${code}`)).body.data;
  const line = firstOrderable(menu);
  const item = menu.categories
    .flatMap((c: any) => c.items)
    .find((i: any) => i.id === line.menuItemId);
  return { token, code, line, unit: item.price as number };
}

const placeOrder = (token: string, code: string, line: any, qty: number) =>
  api()
    .post('/api/admin/orders')
    .set(auth(token))
    .send({ tableCode: code, items: [{ ...line, quantity: qty }] });
const createVoucher = (token: string, body: any) =>
  api().post('/api/admin/vouchers').set(auth(token)).send(body);
const close = (token: string, sessionId: string, body: any) =>
  api().post(`/api/admin/sessions/${sessionId}/close`).set(auth(token)).send(body);
const applyVoucher = (code: string, voucher: string) =>
  api().post('/api/public/voucher').send({ tableCode: code, code: voucher });

describe('vouchers — CRUD', () => {
  it('creates a voucher (code uppercased) and rejects a duplicate', async () => {
    const { token } = await ctx();
    const created = await createVoucher(token, {
      code: 'save10',
      discountType: 'PERCENT',
      discountValue: 10,
    });
    expect(created.status).toBe(201);
    expect(created.body.data.code).toBe('SAVE10');

    const dup = await createVoucher(token, {
      code: 'Save10',
      discountType: 'FIXED',
      discountValue: 5,
    });
    expect(dup.status).toBe(409);

    const list = (await api().get('/api/admin/vouchers').set(auth(token))).body.data;
    expect(list.some((v: any) => v.code === 'SAVE10')).toBe(true);
  });

  it('rejects a percentage over 100', async () => {
    const { token } = await ctx();
    const res = await createVoucher(token, {
      code: 'BAD',
      discountType: 'PERCENT',
      discountValue: 150,
    });
    expect(res.status).toBe(400);
  });
});

describe('vouchers — redemption', () => {
  it('customer applies a voucher; settlement discounts the bill + records it', async () => {
    const { token, code, line, unit } = await ctx();
    await createVoucher(token, { code: 'SAVE10', discountType: 'PERCENT', discountValue: 10 });
    const order = await placeOrder(token, code, line, 4);
    const sessionId = order.body.data.sessionId as string;

    const applied = await applyVoucher(code, 'save10');
    expect(applied.status).toBe(200);
    expect(applied.body.data.code).toBe('SAVE10');
    expect(applied.body.data.estimatedDiscount).toBeCloseTo(round2(unit * 4 * 0.1), 2);

    const closed = await close(token, sessionId, { paymentMethod: 'Cash' });
    expect(closed.status).toBe(200);
    expect(closed.body.data.voucherCode).toBe('SAVE10');
    expect(closed.body.data.voucherDiscount).toBeCloseTo(round2(unit * 4 * 0.1), 2);
    expect(closed.body.data.netTotal).toBeCloseTo(round2(unit * 4 * 0.9), 2);

    const vouchers = (await api().get('/api/admin/vouchers').set(auth(token))).body.data;
    expect(vouchers.find((v: any) => v.code === 'SAVE10').redeemedCount).toBe(1);

    const report = (await api().get('/api/admin/reports/sales').set(auth(token))).body.data;
    expect(report.vouchers.count).toBe(1);
    expect(report.vouchers.amount).toBeCloseTo(round2(unit * 4 * 0.1), 2);
    expect(report.sales.voucherDiscounts).toBeCloseTo(round2(unit * 4 * 0.1), 2);
    expect(report.sales.netSales).toBeCloseTo(round2(unit * 4 * 0.9), 2);
  });

  it('staff applies a FIXED voucher directly at settlement', async () => {
    const { token, code, line, unit } = await ctx();
    await createVoucher(token, { code: 'FIVE', discountType: 'FIXED', discountValue: 5 });
    const order = await placeOrder(token, code, line, 2);
    const closed = await close(token, order.body.data.sessionId, {
      paymentMethod: 'Cash',
      voucherCode: 'five',
    });
    expect(closed.body.data.voucherDiscount).toBeCloseTo(5, 2);
    expect(closed.body.data.netTotal).toBeCloseTo(round2(unit * 2 - 5), 2);
  });

  it('rejects a voucher below the minimum spend', async () => {
    const { token, code, line, unit } = await ctx();
    await createVoucher(token, {
      code: 'BIG',
      discountType: 'PERCENT',
      discountValue: 20,
      minSpend: unit * 10,
    });
    await placeOrder(token, code, line, 1);
    const applied = await applyVoucher(code, 'BIG');
    expect(applied.status).toBe(400);
  });

  it('enforces the usage limit', async () => {
    const { token, code, line } = await ctx();
    await createVoucher(token, {
      code: 'ONCE',
      discountType: 'FIXED',
      discountValue: 1,
      maxRedemptions: 1,
    });
    const o1 = await placeOrder(token, code, line, 1);
    await close(token, o1.body.data.sessionId, { paymentMethod: 'Cash', voucherCode: 'ONCE' });

    await placeOrder(token, code, line, 1);
    const applied = await applyVoucher(code, 'ONCE');
    expect(applied.status).toBe(400);
  });

  it("won't apply an expired voucher", async () => {
    const { token, code, line } = await ctx();
    await createVoucher(token, {
      code: 'OLD',
      discountType: 'FIXED',
      discountValue: 5,
      expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
    });
    await placeOrder(token, code, line, 1);
    const applied = await applyVoucher(code, 'OLD');
    expect(applied.status).toBe(400);
  });
});
