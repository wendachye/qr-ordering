import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant, uid } from '../helpers';
import { prisma } from '../../src/lib/prisma';

async function superAdmin() {
  const { data, body } = await registerTenant();
  await prisma.adminUser.update({ where: { id: data.user.id }, data: { isPlatformAdmin: true } });
  const res = await api()
    .post('/admin/auth/login')
    .send({ email: body.email, password: body.password });
  return res.body.data.token as string;
}

describe('platform clients (super-admin)', () => {
  it('rejects a non-super-admin with 403', async () => {
    const { data } = await registerTenant();
    expect((await api().get('/admin/platform/clients').set(auth(data.token))).status).toBe(403);
  });

  it('creates a client with a first outlet + a working owner login', async () => {
    const token = await superAdmin();
    const email = `owner_${uid()}@test.local`;
    const res = await api().post('/admin/platform/clients').set(auth(token)).send({
      clientName: 'Acme Group',
      contactEmail: 'acme@example.com',
      outletName: 'Acme KL',
      adminEmail: email,
      adminPassword: 'password12345',
      planKey: 'pro',
      trialDays: 7,
    });
    expect(res.status).toBe(201);
    const client = res.body.data;
    expect(client.name).toBe('Acme Group');
    expect(client.outletCount).toBe(1);
    const outlet = client.outlets[0];
    expect(outlet.name).toBe('Acme KL');
    expect(outlet.plan).toBe('pro');
    expect(outlet.subscriptionStatus).toBe('TRIALING');
    expect(outlet.tableCount).toBe(4);

    // The provisioned owner can log in and is scoped to the new outlet.
    const login = await api().post('/admin/auth/login').send({ email, password: 'password12345' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.storeId).toBe(outlet.id);
    expect(login.body.data.user.isPlatformAdmin).toBe(false);

    const list = (await api().get('/admin/platform/clients').set(auth(token))).body.data;
    expect(list.some((c: any) => c.id === client.id)).toBe(true);
  });

  it('edits a client, adds an outlet, edits an outlet, and applies a plan to all', async () => {
    const token = await superAdmin();
    const clientId = (
      await api()
        .post('/admin/platform/clients')
        .set(auth(token))
        .send({ clientName: 'Bistro Co', outletName: 'Bistro One', planKey: 'basic' })
    ).body.data.id;

    const upd = await api()
      .patch(`/admin/platform/clients/${clientId}`)
      .set(auth(token))
      .send({ name: 'Bistro Co.', contactPhone: '012-3456789', isActive: true });
    expect(upd.body.data.name).toBe('Bistro Co.');
    expect(upd.body.data.contactPhone).toBe('012-3456789');

    const withOutlet = await api()
      .post(`/admin/platform/clients/${clientId}/outlets`)
      .set(auth(token))
      .send({ outletName: 'Bistro Two', planKey: 'basic' });
    expect(withOutlet.body.data.outletCount).toBe(2);

    const outletId = withOutlet.body.data.outlets[0].id as string;
    const edited = await api()
      .patch(`/admin/platform/outlets/${outletId}`)
      .set(auth(token))
      .send({ plan: 'pro', subscriptionStatus: 'ACTIVE', trialEndsAt: null });
    const o = edited.body.data.outlets.find((x: any) => x.id === outletId);
    expect(o.plan).toBe('pro');
    expect(o.subscriptionStatus).toBe('ACTIVE');

    const applied = await api()
      .post(`/admin/platform/clients/${clientId}/apply-plan`)
      .set(auth(token))
      .send({ planKey: 'pro', subscriptionStatus: 'ACTIVE' });
    expect(applied.body.data.outlets.every((x: any) => x.plan === 'pro')).toBe(true);
  });

  it('404s an unknown client and rejects a duplicate owner email', async () => {
    const token = await superAdmin();
    expect((await api().get('/admin/platform/clients/nope').set(auth(token))).status).toBe(404);

    const email = `dup_${uid()}@test.local`;
    const first = await api().post('/admin/platform/clients').set(auth(token)).send({
      clientName: 'A',
      outletName: 'A1',
      adminEmail: email,
      adminPassword: 'password12345',
    });
    expect(first.status).toBe(201);
    const second = await api().post('/admin/platform/clients').set(auth(token)).send({
      clientName: 'B',
      outletName: 'B1',
      adminEmail: email,
      adminPassword: 'password12345',
    });
    expect(second.status).toBe(409);
  });

  it('lets a super-admin impersonate an outlet (token scoped to it)', async () => {
    const token = await superAdmin();
    const client = (
      await api()
        .post('/admin/platform/clients')
        .set(auth(token))
        .send({ clientName: 'Imp Co', outletName: 'Imp One', planKey: 'pro' })
    ).body.data;
    const outletId = client.outlets[0].id as string;

    const imp = await api()
      .post(`/admin/platform/outlets/${outletId}/impersonate`)
      .set(auth(token));
    expect(imp.status).toBe(200);
    expect(imp.body.data.outlet.id).toBe(outletId);
    const impToken = imp.body.data.token as string;

    // The token scopes data to the outlet (its 4 starter tables).
    const tables = await api().get('/admin/tables').set(auth(impToken));
    expect(tables.status).toBe(200);
    expect(tables.body.data.length).toBe(4);

    // ...and is NOT a platform-admin token.
    const me = await api().get('/admin/auth/me').set(auth(impToken));
    expect(me.body.data.isPlatformAdmin).toBe(false);
  });

  it('forbids a non-super-admin from impersonating', async () => {
    const { data } = await registerTenant();
    const res = await api()
      .post('/admin/platform/outlets/whatever/impersonate')
      .set(auth(data.token));
    expect(res.status).toBe(403);
  });
});
