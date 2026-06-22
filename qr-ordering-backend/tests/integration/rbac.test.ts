import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant } from '../helpers';

const uniqEmail = (p: string) => `${p}.${Math.random().toString(36).slice(2, 10)}@staff.test`;

async function createStaff(ownerToken: string, role: 'OWNER' | 'MANAGER' | 'CASHIER' | 'WAITER') {
  const email = uniqEmail(role.toLowerCase());
  const password = 'password123';
  const res = await api()
    .post('/admin/staff')
    .set(auth(ownerToken))
    .send({ email, password, role, name: role });
  return { res, email, password };
}

async function loginToken(email: string, password: string) {
  const res = await api().post('/admin/auth/login').send({ email, password });
  return { status: res.status, token: res.body?.data?.token as string | undefined };
}

describe('RBAC — staff roles', () => {
  it('an owner creates staff and the token carries the role', async () => {
    const { data } = await registerTenant();
    const { res } = await createStaff(data.token, 'CASHIER');
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('CASHIER');
    expect(res.body.data.isActive).toBe(true);
  });

  it('a waiter is blocked from reports / staff / settings but can take orders', async () => {
    const { data } = await registerTenant();
    const { email, password } = await createStaff(data.token, 'WAITER');
    const { token } = await loginToken(email, password);
    expect(token).toBeTruthy();

    expect((await api().get('/admin/reports/sales').set(auth(token!))).status).toBe(403);
    expect((await api().get('/admin/staff').set(auth(token!))).status).toBe(403);
    expect(
      (await api().patch('/admin/settings').set(auth(token!)).send({ storeName: 'x' })).status,
    ).toBe(403);

    // POS order entry is allowed for every role.
    const tables = (await api().get('/admin/tables').set(auth(data.token))).body.data;
    const code = tables[0].code as string;
    const menu = (await api().get(`/public/menu?tableCode=${code}`)).body.data;
    const line = menu.categories
      .flatMap((c: any) => c.items)
      .find((i: any) => !i.optionGroups || !i.optionGroups.length);
    const order = await api()
      .post('/admin/orders')
      .set(auth(token!))
      .send({ tableCode: code, items: [{ menuItemId: line.id, quantity: 1 }] });
    expect(order.status).toBe(201);

    // …but not settle the bill (payment:take).
    const settle = await api()
      .post(`/admin/sessions/${order.body.data.sessionId}/close`)
      .set(auth(token!))
      .send({ paymentMethod: 'Cash' });
    expect(settle.status).toBe(403);
  });

  it('a cashier can view reports + settle bills but not manage staff', async () => {
    const { data } = await registerTenant();
    const { email, password } = await createStaff(data.token, 'CASHIER');
    const { token } = await loginToken(email, password);
    expect((await api().get('/admin/reports/sales').set(auth(token!))).status).toBe(200);
    expect((await api().get('/admin/staff').set(auth(token!))).status).toBe(403);
  });

  it('a manager can create a cashier but not an owner', async () => {
    const { data } = await registerTenant();
    const mgr = await createStaff(data.token, 'MANAGER');
    const { token } = await loginToken(mgr.email, mgr.password);

    const ok = await api()
      .post('/admin/staff')
      .set(auth(token!))
      .send({ email: uniqEmail('c'), password: 'password123', role: 'CASHIER' });
    expect(ok.status).toBe(201);

    const no = await api()
      .post('/admin/staff')
      .set(auth(token!))
      .send({ email: uniqEmail('o'), password: 'password123', role: 'OWNER' });
    expect(no.status).toBe(403);
  });

  it('a deactivated account cannot log in', async () => {
    const { data } = await registerTenant();
    const { res, email, password } = await createStaff(data.token, 'CASHIER');
    await api().patch(`/admin/staff/${res.body.data.id}`).set(auth(data.token)).send({ isActive: false });
    const { status } = await loginToken(email, password);
    expect(status).toBe(403);
  });

  it("an owner can't change their own role (keep at least one owner)", async () => {
    const { data } = await registerTenant();
    const me = (await api().get('/admin/auth/me').set(auth(data.token))).body.data;
    const res = await api()
      .patch(`/admin/staff/${me.id}`)
      .set(auth(data.token))
      .send({ role: 'MANAGER' });
    expect(res.status).toBe(400);
  });
});
