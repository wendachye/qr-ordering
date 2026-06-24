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

describe('outlet switching (client owner)', () => {
  it('a registered tenant with no client sees only its own outlet', async () => {
    const { data } = await registerTenant();
    const mine = (await api().get('/admin/outlets').set(auth(data.token))).body.data;
    expect(mine.outlets.length).toBe(1);
    expect(mine.outlets[0].current).toBe(true);
  });

  it('switches between same-client outlets but never across clients', async () => {
    const token = await superAdmin();
    const a1 = `a1_${uid()}@test.local`;
    const a2 = `a2_${uid()}@test.local`;
    const clientA = (
      await api().post('/admin/platform/clients').set(auth(token)).send({
        clientName: 'Group A',
        outletName: 'A One',
        adminEmail: a1,
        adminPassword: 'password12345',
        planKey: 'basic',
      })
    ).body.data;
    await api().post(`/admin/platform/clients/${clientA.id}/outlets`).set(auth(token)).send({
      outletName: 'A Two',
      adminEmail: a2,
      adminPassword: 'password12345',
      planKey: 'basic',
    });

    const bEmail = `b1_${uid()}@test.local`;
    const clientB = (
      await api().post('/admin/platform/clients').set(auth(token)).send({
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
      await api().post('/admin/auth/login').send({ email: a1, password: 'password12345' })
    ).body.data.token as string;

    // Sees both A outlets, exactly one flagged current.
    const mine = (await api().get('/admin/outlets').set(auth(a1Token))).body.data;
    expect(mine.outlets.length).toBe(2);
    expect(mine.outlets.filter((o: { current: boolean }) => o.current).length).toBe(1);
    const aTwo = mine.outlets.find((o: { current: boolean }) => !o.current);

    // Switch → a new token scoped to A Two (its admin identity + its data).
    const sw = await api().post(`/admin/outlets/${aTwo.id}/switch`).set(auth(a1Token));
    expect(sw.status).toBe(200);
    const newToken = sw.body.data.token as string;
    const me = (await api().get('/admin/auth/me').set(auth(newToken))).body.data;
    expect(me.email).toBe(a2);
    const tables = await api().get('/admin/tables').set(auth(newToken));
    expect(tables.body.data.length).toBe(4);

    // Cannot switch into another client's outlet.
    const cross = await api().post(`/admin/outlets/${bOutletId}/switch`).set(auth(a1Token));
    expect(cross.status).toBe(403);
  });
});

describe('shared catalogue provisioning (Phase 3)', () => {
  const mkClient = (token: string, clientName: string, outletName: string) =>
    api()
      .post('/admin/platform/clients')
      .set(auth(token))
      .send({ clientName, outletName, planKey: 'basic' })
      .then((r) => r.body.data);

  it('adds an outlet that joins an existing brand catalogue (shares the menu)', async () => {
    const token = await superAdmin();
    const client = await mkClient(token, `Brand ${uid()}`, 'Flagship');
    // The first outlet minted exactly one catalogue, used by 1 outlet.
    expect(client.catalogues.length).toBe(1);
    const cat = client.catalogues[0];
    expect(cat.outletCount).toBe(1);

    // Put a distinctive dish on the brand menu (via the catalogue).
    const dishName = `Brand Dish ${uid()}`;
    const category = await prisma.menuCategory.findFirst({ where: { catalogueId: cat.id } });
    await prisma.menuItem.create({
      data: {
        storeId: client.outlets[0].id,
        catalogueId: cat.id,
        categoryId: category!.id,
        name: dishName,
        price: 12,
        sortOrder: 5,
      },
    });

    // Add a 2nd outlet that JOINS the existing catalogue.
    const after = (
      await api()
        .post(`/admin/platform/clients/${client.id}/outlets`)
        .set(auth(token))
        .send({ outletName: 'Branch 2', planKey: 'basic', catalogueId: cat.id })
    ).body.data;

    // No new catalogue minted; the existing one is now shared by 2 outlets.
    expect(after.catalogues.length).toBe(1);
    expect(after.catalogues[0].outletCount).toBe(2);

    // The new outlet serves the SAME menu (incl. the brand dish)...
    const branch = after.outlets.find((o: { id: string; name: string }) => o.name === 'Branch 2');
    const table = await prisma.table.findFirst({ where: { storeId: branch.id } });
    const menu = (await api().get(`/public/menu?tableCode=${table!.code}`)).body.data;
    const names = (menu.categories as Array<{ items: Array<{ name: string }> }>)
      .flatMap((c) => c.items)
      .map((i) => i.name);
    expect(names).toContain(dishName);

    // ...and joining did NOT seed a second "Sample Dish" into the shared catalogue.
    const sampleCount = await prisma.menuItem.count({
      where: { catalogueId: cat.id, name: 'Sample Dish' },
    });
    expect(sampleCount).toBe(1);
  });

  it('rejects joining a catalogue that belongs to another client', async () => {
    const token = await superAdmin();
    const a = await mkClient(token, `A ${uid()}`, 'A One');
    const b = await mkClient(token, `B ${uid()}`, 'B One');
    const res = await api()
      .post(`/admin/platform/clients/${b.id}/outlets`)
      .set(auth(token))
      .send({ outletName: 'B Two', planKey: 'basic', catalogueId: a.catalogues[0].id });
    expect(res.status).toBe(400);
  });
});
