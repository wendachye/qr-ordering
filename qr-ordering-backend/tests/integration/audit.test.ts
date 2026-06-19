import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant, uid } from '../helpers';
import { prisma } from '../../src/lib/prisma';

async function superAdmin() {
  const { data, body } = await registerTenant();
  await prisma.adminUser.update({ where: { id: data.user.id }, data: { isPlatformAdmin: true } });
  const res = await api()
    .post('/admin/auth/login')
    .send({ email: body.email, password: body.password });
  return { token: res.body.data.token as string, email: body.email as string };
}

function decodeJwt(token: string): { iat: number; exp: number; imp?: string } {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}

describe('operator audit log', () => {
  it('forbids a non-super-admin from reading the audit log', async () => {
    const { data } = await registerTenant();
    expect((await api().get('/admin/platform/audit').set(auth(data.token))).status).toBe(403);
  });

  it('records client.create and plan.update, attributed to the operator', async () => {
    const { token, email } = await superAdmin();

    const created = await api()
      .post('/admin/platform/clients')
      .set(auth(token))
      .send({ clientName: `Audit Co ${uid()}`, outletName: 'Audit One', planKey: 'basic' });
    const clientId = created.body.data.id as string;

    await api().patch('/admin/platform/plans/pro').set(auth(token)).send({ monthlyPrice: 99 });

    const list = (await api().get('/admin/platform/audit?action=client.create').set(auth(token)))
      .body.data;
    const entry = list.entries.find((e: { entityId: string }) => e.entityId === clientId);
    expect(entry).toBeTruthy();
    expect(entry.actorEmail).toBe(email);
    expect(entry.entity).toBe('Client');

    const planRows = await prisma.auditLog.findMany({
      where: { action: 'plan.update', entityId: 'pro' },
    });
    expect(planRows.length).toBeGreaterThan(0);
  });

  it('records impersonation, scopes a short-lived token, and surfaces imp on /me', async () => {
    const { token, email } = await superAdmin();
    const client = (
      await api()
        .post('/admin/platform/clients')
        .set(auth(token))
        .send({ clientName: `Imp Audit ${uid()}`, outletName: 'Imp One', planKey: 'pro' })
    ).body.data;
    const outletId = client.outlets[0].id as string;

    const imp = await api()
      .post(`/admin/platform/outlets/${outletId}/impersonate`)
      .set(auth(token));
    const impToken = imp.body.data.token as string;

    // Token is short-lived (<= 15 minutes) and carries the operator as `imp`.
    const decoded = decodeJwt(impToken);
    expect(decoded.exp - decoded.iat).toBeLessThanOrEqual(15 * 60);
    expect(decoded.imp).toBe(email);

    // /me surfaces the impersonator so the UI can label the session.
    const me = await api().get('/admin/auth/me').set(auth(impToken));
    expect(me.body.data.imp).toBe(email);
    expect(me.body.data.isPlatformAdmin).toBe(false);

    const rows = await prisma.auditLog.findMany({
      where: { action: 'outlet.impersonate', storeId: outletId },
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].actorEmail).toBe(email);
  });
});
