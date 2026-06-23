import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant } from '../helpers';

async function ctx() {
  const { data } = await registerTenant();
  const token = data.token as string;
  const cats = (await api().get('/admin/menu/categories').set(auth(token))).body.data;
  const item = (
    await api()
      .post('/admin/menu/items')
      .set(auth(token))
      .send({ categoryId: cats[0].id, name: 'Inv Item', price: 20 })
  ).body.data;
  const code = (await api().get('/admin/tables').set(auth(token))).body.data[0].code as string;
  return { token, item, code };
}

async function settledSession(token: string, code: string, itemId: string, qty = 2) {
  const order = await api()
    .post('/orders')
    .send({ tableCode: code, items: [{ menuItemId: itemId, quantity: qty }] });
  const sessionId = order.body.data.sessionId as string;
  await api().post(`/admin/sessions/${sessionId}/close`).set(auth(token)).send({ paymentMethod: 'Cash' });
  return sessionId;
}

describe('Malaysia e-Invoice (MyInvois)', () => {
  it('requires a seller TIN before issuing', async () => {
    const { token, item, code } = await ctx();
    const sessionId = await settledSession(token, code, item.id);
    const res = await api()
      .post(`/admin/einvoice/sessions/${sessionId}/issue`)
      .set(auth(token))
      .send({ buyerName: 'ACME' });
    expect(res.status).toBe(400);
  });

  it('issues a sequential invoice and submits it via the sandbox adapter', async () => {
    const { token, item, code } = await ctx();
    const cfg = await api()
      .patch('/admin/einvoice/settings')
      .set(auth(token))
      .send({ einvoiceEnabled: true, sellerTin: 'C1234567890', sellerRegistrationNo: '201901000001' });
    expect(cfg.status).toBe(200);
    expect(cfg.body.data.sellerTin).toBe('C1234567890');

    const sessionId = await settledSession(token, code, item.id);
    const issued = await api()
      .post(`/admin/einvoice/sessions/${sessionId}/issue`)
      .set(auth(token))
      .send({ buyerName: 'ACME Sdn Bhd', buyerTin: 'C9999999999' });
    expect(issued.status).toBe(201);
    const inv = issued.body.data;
    expect(inv.number).toMatch(/^INV-\d{4}-000001$/);
    expect(inv.status).toBe('draft');
    expect(inv.total).toBeCloseTo(40, 2); // 2 × 20, no tax/charge on a fresh tenant
    expect(inv.buyerTin).toBe('C9999999999');
    expect(inv.document.supplier.tin).toBe('C1234567890');

    // Idempotent: re-issuing returns the same invoice.
    const again = await api()
      .post(`/admin/einvoice/sessions/${sessionId}/issue`)
      .set(auth(token))
      .send({});
    expect(again.body.data.id).toBe(inv.id);
    expect(again.body.data.number).toBe(inv.number);

    // Submit → sandbox stub returns identifiers + a 'valid' status.
    const submitted = await api()
      .post(`/admin/einvoice/invoices/${inv.id}/submit`)
      .set(auth(token))
      .send({});
    expect(submitted.status).toBe(200);
    expect(submitted.body.data.status).toBe('valid');
    expect(submitted.body.data.submissionUid).toContain('SANDBOX-');
    expect(submitted.body.data.qrCode).toContain('myinvois');

    // A second settled tab → the invoice number increments (gapless).
    const session2 = await settledSession(token, code, item.id);
    const inv2 = (
      await api().post(`/admin/einvoice/sessions/${session2}/issue`).set(auth(token)).send({})
    ).body.data;
    expect(inv2.number).toMatch(/^INV-\d{4}-000002$/);

    const list = (await api().get('/admin/einvoice/invoices').set(auth(token))).body.data;
    expect(list.total).toBe(2);
  });

  it('rejects issuing for an unsettled tab', async () => {
    const { token, item, code } = await ctx();
    await api().patch('/admin/einvoice/settings').set(auth(token)).send({ sellerTin: 'C1' });
    const order = await api()
      .post('/orders')
      .send({ tableCode: code, items: [{ menuItemId: item.id, quantity: 1 }] });
    const sessionId = order.body.data.sessionId; // still OPEN
    const res = await api()
      .post(`/admin/einvoice/sessions/${sessionId}/issue`)
      .set(auth(token))
      .send({});
    expect(res.status).toBe(400);
  });
});
