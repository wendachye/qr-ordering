import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant } from '../helpers';
import { handleSubscriptionEvent } from '../../src/modules/billing/billing.service';
import { prisma } from '../../src/lib/prisma';

describe('billing + subscription gating', () => {
  it('a fresh tenant is on a trial and can operate', async () => {
    const { data } = await registerTenant();
    const billing = (await api().get('/api/admin/billing').set(auth(data.token))).body.data;
    expect(billing.status).toBe('TRIALING');
    expect(billing.active).toBe(true);
    expect(billing.trialDaysLeft).toBeGreaterThan(0);
    expect((await api().get('/api/admin/floor').set(auth(data.token))).status).toBe(200);
  });

  it('blocks operational routes with 402 once the trial has expired', async () => {
    const { data } = await registerTenant();
    await prisma.store.update({
      where: { id: data.user.storeId },
      data: { trialEndsAt: new Date(Date.now() - 1000) },
    });
    // Operational route is gated…
    expect((await api().get('/api/admin/floor').set(auth(data.token))).status).toBe(402);
    // …but the account area (auth + billing + settings) stays reachable.
    expect((await api().get('/api/admin/auth/me').set(auth(data.token))).status).toBe(200);
    expect((await api().get('/api/admin/billing').set(auth(data.token))).status).toBe(200);
    expect((await api().get('/api/admin/settings').set(auth(data.token))).status).toBe(200);
  });

  it('an ACTIVE subscription restores access after the trial', async () => {
    const { data } = await registerTenant();
    await prisma.store.update({
      where: { id: data.user.storeId },
      data: { trialEndsAt: new Date(Date.now() - 1000), subscriptionStatus: 'ACTIVE' },
    });
    expect((await api().get('/api/admin/floor').set(auth(data.token))).status).toBe(200);
  });

  it('treats a never-paid (incomplete) subscription as inactive', async () => {
    const { data } = await registerTenant();
    const customerId = `cus_test_${data.user.storeId}`;
    await prisma.store.update({
      where: { id: data.user.storeId },
      data: { stripeCustomerId: customerId },
    });
    // Simulate Stripe's customer.subscription.created with an unpaid first invoice.
    await handleSubscriptionEvent({
      id: `sub_${data.user.storeId}`,
      status: 'incomplete',
      customer: customerId,
      items: { data: [] },
      current_period_end: null,
    });
    const store = await prisma.store.findUnique({ where: { id: data.user.storeId } });
    expect(store!.subscriptionStatus).toBe('CANCELED');
    expect((await api().get('/api/admin/floor').set(auth(data.token))).status).toBe(402);
  });

  it('reads current_period_end from the subscription item (Stripe basil+ API)', async () => {
    const { data } = await registerTenant();
    const customerId = `cus_cpe_${data.user.storeId}`;
    await prisma.store.update({
      where: { id: data.user.storeId },
      data: { stripeCustomerId: customerId },
    });
    const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
    // Newer Stripe API versions carry current_period_end on the item, not the root.
    await handleSubscriptionEvent({
      id: `sub_cpe_${data.user.storeId}`,
      status: 'active',
      customer: customerId,
      items: { data: [{ price: { id: 'price_test_pro' }, current_period_end: periodEnd }] },
    });
    const store = await prisma.store.findUnique({ where: { id: data.user.storeId } });
    expect(store!.currentPeriodEnd).not.toBeNull();
    expect(Math.floor(store!.currentPeriodEnd!.getTime() / 1000)).toBe(periodEnd);
  });

  it('checkout fails cleanly (503) when Stripe is not configured', async () => {
    const { data } = await registerTenant();
    const res = await api()
      .post('/api/admin/billing/checkout')
      .set(auth(data.token))
      .send({ plan: 'basic' });
    expect(res.status).toBe(503);
  });
});
