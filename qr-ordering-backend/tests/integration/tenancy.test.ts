import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant, uid } from '../helpers';

describe('tenant isolation', () => {
  it('keeps each tenant scoped and blocks cross-tenant by-id access', async () => {
    const a = (await registerTenant()).data;
    const b = (await registerTenant()).data;

    // Tenant A opens a tab by placing an order on its own table + menu item.
    const floorA = (await api().get('/api/admin/floor').set(auth(a.token))).body.data;
    const tableA = floorA[0].table;
    const menuA = (await api().get('/api/admin/menu/items').set(auth(a.token))).body.data;
    const order = await api()
      .post('/api/admin/orders')
      .set(auth(a.token))
      .send({
        tableCode: tableA.code,
        items: [{ menuItemId: menuA[0].id, quantity: 1, optionChoiceIds: [] }],
      });
    expect(order.status).toBe(201);
    const sessionId = order.body.data.sessionId as string;
    const orderId = order.body.data.id as string;

    // Tenant B sees only its own (empty) data.
    const floorB = (await api().get('/api/admin/floor').set(auth(b.token))).body.data;
    expect(floorB.every((e: any) => !e.session)).toBe(true);
    expect((await api().get('/api/admin/orders').set(auth(b.token))).body.data.length).toBe(0);

    // Cross-tenant by-id access (read + mutate) all 404.
    expect((await api().get(`/api/admin/sessions/${sessionId}`).set(auth(b.token))).status).toBe(
      404,
    );
    expect((await api().get(`/api/admin/orders/${orderId}`).set(auth(b.token))).status).toBe(404);
    expect(
      (
        await api()
          .patch(`/api/admin/menu/items/${menuA[0].id}`)
          .set(auth(b.token))
          .send({ isAvailable: false })
      ).status,
    ).toBe(404);
    expect(
      (
        await api()
          .patch(`/api/admin/tables/${tableA.id}`)
          .set(auth(b.token))
          .send({ name: 'HACKED' })
      ).status,
    ).toBe(404);

    // Idempotency keys are namespaced per table (which maps 1:1 to a tenant):
    // B reusing A's key on B's own table creates a NEW order, never replays A's.
    const sharedKey = `shared-${uid()}`;
    const tableB = (await api().get('/api/admin/floor').set(auth(b.token))).body.data[0].table;
    const menuB = (await api().get('/api/admin/menu/items').set(auth(b.token))).body.data;
    const oA = await api()
      .post('/api/admin/orders')
      .set(auth(a.token))
      .set('Idempotency-Key', sharedKey)
      .send({
        tableCode: tableA.code,
        items: [{ menuItemId: menuA[0].id, quantity: 1, optionChoiceIds: [] }],
      });
    const oB = await api()
      .post('/api/admin/orders')
      .set(auth(b.token))
      .set('Idempotency-Key', sharedKey)
      .send({
        tableCode: tableB.code,
        items: [{ menuItemId: menuB[0].id, quantity: 1, optionChoiceIds: [] }],
      });
    expect(oA.status).toBe(201);
    expect(oB.status).toBe(201);
    expect(oA.body.data.id).not.toBe(oB.body.data.id);
  });
});
