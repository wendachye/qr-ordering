import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { prisma } from '../../src/lib/prisma';
import { resolveEntitlements, getPlan, listPlanDefs } from '../../src/lib/entitlements';

const future = () => new Date(Date.now() + 86_400_000);
const past = () => new Date(Date.now() - 86_400_000);

// Start from an empty Plan table so the built-in DEFAULT_PLANS apply
// deterministically; the override case creates its own row then cleans up.
beforeAll(async () => {
  await prisma.plan.deleteMany({});
});
afterAll(async () => {
  await prisma.plan.deleteMany({});
});

describe('entitlements', () => {
  it('an active trial grants full Pro', async () => {
    const e = await resolveEntitlements({
      plan: null,
      subscriptionStatus: 'TRIALING',
      trialEndsAt: future(),
    });
    expect(e.isTrial).toBe(true);
    expect(e.tier).toBe('pro');
    expect(e.features.has('loyalty')).toBe(true);
    expect(e.features.has('vouchers')).toBe(true);
    expect(e.limits.maxTables).toBeNull();
  });

  it('an expired trial falls back to the stored plan', async () => {
    const e = await resolveEntitlements({
      plan: 'basic',
      subscriptionStatus: 'TRIALING',
      trialEndsAt: past(),
    });
    expect(e.isTrial).toBe(false);
    expect(e.tier).toBe('basic');
    expect(e.features.size).toBe(0);
    expect(e.limits.maxTables).toBe(10);
    expect(e.limits.maxMenuItems).toBe(50);
  });

  it('Basic has no Pro features + capped limits; Pro is unlimited', async () => {
    const basic = await resolveEntitlements({
      plan: 'basic',
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
    });
    expect(basic.features.has('loyalty')).toBe(false);
    expect(basic.limits.maxTables).toBe(10);

    const pro = await resolveEntitlements({
      plan: 'pro',
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
    });
    expect([...pro.features].sort()).toEqual([
      'loyalty',
      'reports_advanced',
      'tax_multi',
      'vouchers',
    ]);
    expect(pro.limits.maxTables).toBeNull();
    expect(pro.limits.maxMenuItems).toBeNull();
  });

  it('treats legacy "starter" as Basic', async () => {
    const e = await resolveEntitlements({
      plan: 'starter',
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
    });
    expect(e.tier).toBe('basic');
    expect(e.features.size).toBe(0);
  });

  it('lists both canonical plans (defaults) in order', async () => {
    const plans = await listPlanDefs();
    expect(plans.map((p) => p.key)).toEqual(['basic', 'pro']);
    expect((await getPlan('pro')).features).toContain('loyalty');
  });

  it('a DB Plan row overrides the default (configurability)', async () => {
    await prisma.plan.upsert({
      where: { key: 'basic' },
      update: { features: ['loyalty'], maxTables: 3 },
      create: {
        key: 'basic',
        name: 'Basic',
        features: ['loyalty'],
        maxTables: 3,
        maxMenuItems: 50,
      },
    });
    const e = await resolveEntitlements({
      plan: 'basic',
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
    });
    expect(e.features.has('loyalty')).toBe(true);
    expect(e.limits.maxTables).toBe(3);
    await prisma.plan.deleteMany({});
  });
});
