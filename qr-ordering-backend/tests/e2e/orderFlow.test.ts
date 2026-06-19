import { describe, it, expect } from 'vitest';

import { api, auth, login, firstOrderable } from '../helpers';

// Full journey across modules: customer order -> admin floor -> settle payment.
describe('e2e: customer order to settled tab', () => {
  it('an order opens a tab on the floor, then settles via payment', async () => {
    const admin = await login('admin@example.com', 'password123');

    // 1) Customer places an order on TBL001.
    const menu = (await api().get('/api/public/menu?tableCode=TBL001')).body.data;
    const order = await api()
      .post('/api/orders')
      .send({ tableCode: 'TBL001', items: [{ ...firstOrderable(menu), quantity: 2 }] });
    expect(order.status).toBe(201);
    const sessionId = order.body.data.sessionId as string;

    // 2) Admin sees TBL001 occupied by that session.
    const floor = (await api().get('/api/admin/floor').set(auth(admin.token))).body.data;
    const occ = floor.find((e: any) => e.table.code === 'TBL001');
    expect(occ.session?.id).toBe(sessionId);

    // 3) The session detail shows the round.
    const session = (await api().get(`/api/admin/sessions/${sessionId}`).set(auth(admin.token)))
      .body.data;
    expect(session.rounds.length).toBeGreaterThan(0);

    // 4) Make payment -> session CLOSED.
    const closed = await api()
      .post(`/api/admin/sessions/${sessionId}/close`)
      .set(auth(admin.token))
      .send({ paymentMethod: 'Cash' });
    expect(closed.status).toBe(200);
    expect(closed.body.data.status).toBe('CLOSED');

    // 5) The table is free again on the floor.
    const floor2 = (await api().get('/api/admin/floor').set(auth(admin.token))).body.data;
    expect(floor2.find((e: any) => e.table.code === 'TBL001').session).toBeFalsy();
  });
});
