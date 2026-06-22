import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant } from '../helpers';

describe('auth', () => {
  it('logs in the seeded admin and returns a tenant-scoped token', async () => {
    const res = await api()
      .post('/admin/auth/login')
      .send({ email: 'admin@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.storeId).toBeTruthy();
  });

  it('rejects a wrong password with 401 (same as unknown email)', async () => {
    const { body } = await registerTenant();
    const res = await api()
      .post('/admin/auth/login')
      .send({ email: body.email, password: 'definitely-wrong' });
    expect(res.status).toBe(401);
  });

  it('locks an account after 5 consecutive failures', async () => {
    const { body } = await registerTenant();
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await api().post('/admin/auth/login').send({ email: body.email, password: 'nope' });
      statuses.push(r.status);
    }
    expect(statuses.slice(0, 4)).toEqual([401, 401, 401, 401]);
    expect(statuses[4]).toBe(423);
    // The correct password is now locked out too.
    const r = await api()
      .post('/admin/auth/login')
      .send({ email: body.email, password: body.password });
    expect(r.status).toBe(423);
  });

  it('provisions a tenant with an isolated 4-table starter workspace', async () => {
    const { data } = await registerTenant();
    const floor = await api().get('/admin/floor').set(auth(data.token));
    expect(floor.body.data.length).toBe(4);
  });

  it('rejects a duplicate tenant email', async () => {
    await expect(registerTenant({ email: 'admin@example.com' })).rejects.toThrow();
  });
});
