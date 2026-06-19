import { describe, it, expect } from 'vitest';

import { api, firstOrderable } from '../helpers';

describe('orders + idempotency', () => {
  it('places a public order on the seeded table', async () => {
    const menu = (await api().get('/public/menu?tableCode=TBL001')).body.data;
    const res = await api()
      .post('/orders')
      .send({ tableCode: 'TBL001', items: [firstOrderable(menu)] });
    expect(res.status).toBe(201);
    expect(res.body.data.orderNumber).toBeGreaterThan(0);
  });

  it('de-dupes a replayed Idempotency-Key (same order returned)', async () => {
    const menu = (await api().get('/public/menu?tableCode=TBL001')).body.data;
    const payload = { tableCode: 'TBL001', items: [firstOrderable(menu)] };
    const key = `idem-test-${process.hrtime.bigint().toString(36)}`;

    const a = await api().post('/orders').set('Idempotency-Key', key).send(payload);
    const b = await api().post('/orders').set('Idempotency-Key', key).send(payload);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.body.data.id).toBe(a.body.data.id);
    expect(b.body.data.orderNumber).toBe(a.body.data.orderNumber);
  });

  it('rejects an order for an unknown table', async () => {
    const res = await api()
      .post('/orders')
      .send({ tableCode: 'NOPE', items: [{ menuItemId: 'x', quantity: 1, optionChoiceIds: [] }] });
    expect(res.status).toBe(404);
  });
});
