import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { api, auth, registerTenant } from '../helpers';
import { prisma } from '../../src/lib/prisma';

const PRO_FEATURES = ['loyalty', 'vouchers', 'reports_advanced', 'tax_multi'];

// Pin the global Plan catalogue to known values so the gate assertions don't
// depend on whatever other test files left in the (global, non-tenant) Plan
// table. Other suites use fresh trialing tenants — which resolve to Pro — so
// these Basic values never affect them.
async function setBasicLimits(maxTables: number | null, maxMenuItems: number | null) {
  await prisma.plan.upsert({
    where: { key: 'basic' },
    update: { features: [], maxTables, maxMenuItems, isActive: true },
    create: {
      key: 'basic',
      name: 'Basic',
      monthlyPrice: 49,
      currency: 'MYR',
      features: [],
      maxTables,
      maxMenuItems,
      sortOrder: 0,
      isActive: true,
    },
  });
}

// Move a fresh (trialing) tenant onto an ACTIVE Basic subscription, so its
// entitlements resolve to Basic (no features, capped limits) rather than the
// trial's full-Pro grant.
async function downgradeToBasic(storeId: string) {
  await prisma.store.update({
    where: { id: storeId },
    data: {
      plan: 'basic',
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: new Date(Date.now() - 1000),
    },
  });
}

describe('plan entitlement gates', () => {
  beforeAll(async () => {
    await setBasicLimits(10, 50);
    await prisma.plan.upsert({
      where: { key: 'pro' },
      update: { features: PRO_FEATURES, maxTables: null, maxMenuItems: null, isActive: true },
      create: {
        key: 'pro',
        name: 'Pro',
        monthlyPrice: 149,
        currency: 'MYR',
        features: PRO_FEATURES,
        maxTables: null,
        maxMenuItems: null,
        sortOrder: 1,
        isActive: true,
      },
    });
  });

  it('grants full Pro entitlements during the trial', async () => {
    const { data } = await registerTenant();
    const ent = (await api().get('/admin/entitlements').set(auth(data.token))).body.data;
    expect(ent.isTrial).toBe(true);
    expect(ent.tier).toBe('pro');
    expect(ent.features).toEqual(expect.arrayContaining(PRO_FEATURES));
    expect(ent.limits).toEqual({ maxTables: null, maxMenuItems: null });
    // Gated routers are reachable during the trial.
    expect((await api().get('/admin/loyalty/config').set(auth(data.token))).status).toBe(200);
    expect((await api().get('/admin/vouchers').set(auth(data.token))).status).toBe(200);
  });

  it('reports the resolved tier + live usage on the entitlements endpoint', async () => {
    const { data } = await registerTenant();
    await downgradeToBasic(data.user.storeId);
    const ent = (await api().get('/admin/entitlements').set(auth(data.token))).body.data;
    expect(ent.tier).toBe('basic');
    expect(ent.isTrial).toBe(false);
    expect(ent.features).not.toContain('loyalty');
    expect(ent.limits).toEqual({ maxTables: 10, maxMenuItems: 50 });
    expect(typeof ent.usage.tables).toBe('number');
    expect(typeof ent.usage.menuItems).toBe('number');
  });

  it('blocks gated feature routers for a Basic tenant (403 PLAN_FEATURE_LOCKED)', async () => {
    const { data } = await registerTenant();
    await downgradeToBasic(data.user.storeId);

    const loyalty = await api().get('/admin/loyalty/config').set(auth(data.token));
    expect(loyalty.status).toBe(403);
    expect(loyalty.body.error.code).toBe('PLAN_FEATURE_LOCKED');
    expect(loyalty.body.error.details.feature).toBe('loyalty');

    const vouchers = await api().get('/admin/vouchers').set(auth(data.token));
    expect(vouchers.status).toBe(403);
    expect(vouchers.body.error.code).toBe('PLAN_FEATURE_LOCKED');
  });

  it('gates multiple taxes + a service charge but allows a single tax', async () => {
    const { data } = await registerTenant();
    await downgradeToBasic(data.user.storeId);

    // One tax, no service charge — allowed on every plan.
    const single = await api()
      .patch('/admin/settings')
      .set(auth(data.token))
      .send({ taxes: [{ name: 'SST', rate: 6 }] });
    expect(single.status).toBe(200);

    // A service charge requires Pro.
    const sc = await api()
      .patch('/admin/settings')
      .set(auth(data.token))
      .send({ serviceChargeRate: 10 });
    expect(sc.status).toBe(403);
    expect(sc.body.error.code).toBe('PLAN_FEATURE_LOCKED');

    // A second tax requires Pro.
    const multi = await api()
      .patch('/admin/settings')
      .set(auth(data.token))
      .send({
        taxes: [
          { name: 'SST', rate: 6 },
          { name: 'GST', rate: 4 },
        ],
      });
    expect(multi.status).toBe(403);
  });

  it('allows the single-day Z-reading but gates custom date ranges', async () => {
    const { data } = await registerTenant();
    await downgradeToBasic(data.user.storeId);

    expect((await api().get('/admin/reports/sales').set(auth(data.token))).status).toBe(200);

    const range = await api()
      .get('/admin/reports/sales?from=2026-01-01&to=2026-01-31')
      .set(auth(data.token));
    expect(range.status).toBe(403);
    expect(range.body.error.code).toBe('PLAN_FEATURE_LOCKED');
  });

  describe('plan limits', () => {
    beforeAll(() => setBasicLimits(0, 0));
    afterAll(() => setBasicLimits(10, 50));

    it('blocks creating a table over the plan cap (403 PLAN_LIMIT_REACHED)', async () => {
      const { data } = await registerTenant();
      await downgradeToBasic(data.user.storeId);
      const res = await api()
        .post('/admin/tables')
        .set(auth(data.token))
        .send({ name: 'Cap Table', isActive: true });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PLAN_LIMIT_REACHED');
      expect(res.body.error.details.resource).toBe('tables');
    });

    it('blocks creating a menu item over the plan cap (403 PLAN_LIMIT_REACHED)', async () => {
      const { data } = await registerTenant();
      await downgradeToBasic(data.user.storeId);
      const cat = await api()
        .post('/admin/menu/categories')
        .set(auth(data.token))
        .send({ name: 'Capped' });
      expect(cat.status).toBe(201);
      const res = await api()
        .post('/admin/menu/items')
        .set(auth(data.token))
        .send({ categoryId: cat.body.data.id, name: 'Over Limit', price: 10 });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PLAN_LIMIT_REACHED');
      expect(res.body.error.details.resource).toBe('menuItems');
    });
  });
});
