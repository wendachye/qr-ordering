import { describe, it, expect, afterAll } from 'vitest';

import { api, auth, registerTenant } from '../helpers';
import { prisma } from '../../src/lib/prisma';

// Register a tenant, flip its admin to platform super-admin, then re-login so the
// token carries isPlatformAdmin.
async function superAdmin() {
  const { data, body } = await registerTenant();
  await prisma.adminUser.update({ where: { id: data.user.id }, data: { isPlatformAdmin: true } });
  const res = await api()
    .post('/admin/auth/login')
    .send({ email: body.email, password: body.password });
  return res.body.data.token as string;
}

// The Plan table is global; keep it clean so edits don't bleed across suites.
afterAll(async () => {
  await prisma.plan.deleteMany({});
});

describe('platform plans (super-admin)', () => {
  it('rejects a non-super-admin with 403', async () => {
    const { data } = await registerTenant();
    const res = await api().get('/admin/platform/plans').set(auth(data.token));
    expect(res.status).toBe(403);
  });

  it('lists the two canonical plans for a super-admin', async () => {
    const token = await superAdmin();
    const res = await api().get('/admin/platform/plans').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: any) => p.key)).toEqual(['basic', 'pro']);
    const pro = res.body.data.find((p: any) => p.key === 'pro');
    expect(pro.features).toContain('loyalty');
    expect(pro.maxTables).toBeNull();
  });

  it('edits a plan (name, price, features, limits) and round-trips', async () => {
    const token = await superAdmin();
    const res = await api()
      .patch('/admin/platform/plans/basic')
      .set(auth(token))
      .send({
        name: 'Basic Plan',
        monthlyPrice: 59,
        features: ['vouchers'],
        maxTables: 5,
        stripePriceId: 'price_basic_123',
      });
    expect(res.status).toBe(200);
    const basic = res.body.data.find((p: any) => p.key === 'basic');
    expect(basic.name).toBe('Basic Plan');
    expect(basic.monthlyPrice).toBeCloseTo(59, 2);
    expect(basic.features).toEqual(['vouchers']);
    expect(basic.maxTables).toBe(5);
    expect(basic.stripePriceId).toBe('price_basic_123');

    // A second super-admin sees the persisted edit.
    const token2 = await superAdmin();
    const again = (await api().get('/admin/platform/plans').set(auth(token2))).body.data;
    expect(again.find((p: any) => p.key === 'basic').name).toBe('Basic Plan');
  });

  it('rejects an unknown plan key with 404', async () => {
    const token = await superAdmin();
    const res = await api()
      .patch('/admin/platform/plans/enterprise')
      .set(auth(token))
      .send({ name: 'Enterprise' });
    expect(res.status).toBe(404);
  });
});
