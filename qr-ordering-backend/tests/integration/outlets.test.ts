import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant, uid } from '../helpers';
import { prisma } from '../../src/lib/prisma';

async function superAdmin() {
  const { data, body } = await registerTenant();
  await prisma.adminUser.update({ where: { id: data.user.id }, data: { isPlatformAdmin: true } });
  const res = await api()
    .post('/api/admin/auth/login')
    .send({ email: body.email, password: body.password });
  return res.body.data.token as string;
}

describe('outlet switching (client owner)', () => {
  it('a registered tenant with no client sees only its own outlet', async () => {
    const { data } = await registerTenant();
    const mine = (await api().get('/api/admin/outlets').set(auth(data.token))).body.data;
    expect(mine.outlets.length).toBe(1);
    expect(mine.outlets[0].current).toBe(true);
  });

  it('switches between same-client outlets but never across clients', async () => {
    const token = await superAdmin();
    const a1 = `a1_${uid()}@test.local`;
    const a2 = `a2_${uid()}@test.local`;
    const clientA = (
      await api().post('/api/admin/platform/clients').set(auth(token)).send({
        clientName: 'Group A',
        outletName: 'A One',
        adminEmail: a1,
        adminPassword: 'password12345',
        planKey: 'basic',
      })
    ).body.data;
    await api().post(`/api/admin/platform/clients/${clientA.id}/outlets`).set(auth(token)).send({
      outletName: 'A Two',
      adminEmail: a2,
      adminPassword: 'password12345',
      planKey: 'basic',
    });

    const bEmail = `b1_${uid()}@test.local`;
    const clientB = (
      await api().post('/api/admin/platform/clients').set(auth(token)).send({
        clientName: 'Group B',
        outletName: 'B One',
        adminEmail: bEmail,
        adminPassword: 'password12345',
        planKey: 'basic',
      })
    ).body.data;
    const bOutletId = clientB.outlets[0].id as string;

    // Log in as A One's admin (a real tenant session).
    const a1Token = (
      await api().post('/api/admin/auth/login').send({ email: a1, password: 'password12345' })
    ).body.data.token as string;

    // Sees both A outlets, exactly one flagged current.
    const mine = (await api().get('/api/admin/outlets').set(auth(a1Token))).body.data;
    expect(mine.outlets.length).toBe(2);
    expect(mine.outlets.filter((o: { current: boolean }) => o.current).length).toBe(1);
    const aTwo = mine.outlets.find((o: { current: boolean }) => !o.current);

    // Switch → a new token scoped to A Two (its admin identity + its data).
    const sw = await api().post(`/api/admin/outlets/${aTwo.id}/switch`).set(auth(a1Token));
    expect(sw.status).toBe(200);
    const newToken = sw.body.data.token as string;
    const me = (await api().get('/api/admin/auth/me').set(auth(newToken))).body.data;
    expect(me.email).toBe(a2);
    const tables = await api().get('/api/admin/tables').set(auth(newToken));
    expect(tables.body.data.length).toBe(4);

    // Cannot switch into another client's outlet.
    const cross = await api().post(`/api/admin/outlets/${bOutletId}/switch`).set(auth(a1Token));
    expect(cross.status).toBe(403);
  });
});
