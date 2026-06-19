import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/response';
import { config } from '../../config/env';
import { logger } from '../../lib/logger';
import { getDefaultStoreId } from '../../lib/store';
import { stripe, PLANS, type PlanKey } from '../../lib/stripe';

export type BillingStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';

/** Whether a store may use the product right now. */
export function isBillingActive(s: {
  subscriptionStatus: BillingStatus;
  trialEndsAt: Date | null;
}): boolean {
  switch (s.subscriptionStatus) {
    case 'ACTIVE':
    case 'PAST_DUE': // grace period while Stripe retries the payment
      return true;
    case 'TRIALING':
      return !s.trialEndsAt || s.trialEndsAt.getTime() > Date.now();
    default: // CANCELED
      return false;
  }
}

export async function isStoreBillingActive(storeId: string): Promise<boolean> {
  const s = await prisma.store.findUnique({
    where: { id: storeId },
    select: { subscriptionStatus: true, trialEndsAt: true },
  });
  return !!s && isBillingActive(s);
}

/** Current tenant's billing summary for the admin dashboard. */
export async function getBillingState() {
  const storeId = await getDefaultStoreId();
  const s = await prisma.store.findUniqueOrThrow({
    where: { id: storeId },
    select: {
      plan: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
    },
  });
  const active = isBillingActive(s);
  const trialDaysLeft =
    s.subscriptionStatus === 'TRIALING' && s.trialEndsAt
      ? Math.max(0, Math.ceil((s.trialEndsAt.getTime() - Date.now()) / 86_400_000))
      : null;
  return {
    plan: s.plan,
    status: s.subscriptionStatus,
    active,
    trialEndsAt: s.trialEndsAt,
    trialDaysLeft,
    currentPeriodEnd: s.currentPeriodEnd,
    billingEnabled: !!stripe,
    plans: Object.values(PLANS).map((p) => ({ key: p.key, name: p.name })),
  };
}

async function ensureCustomer(storeId: string): Promise<string> {
  if (!stripe) throw new ApiError(503, 'Billing is not configured', 'BILLING_DISABLED');
  const s = await prisma.store.findUniqueOrThrow({
    where: { id: storeId },
    select: {
      stripeCustomerId: true,
      name: true,
      adminUsers: { select: { email: true }, take: 1 },
    },
  });
  if (s.stripeCustomerId) return s.stripeCustomerId;
  // Idempotency key dedupes concurrent creates so Stripe returns one customer.
  const customer = await stripe.customers.create(
    { name: s.name, email: s.adminUsers[0]?.email, metadata: { storeId } },
    { idempotencyKey: `customer_${storeId}` },
  );
  // Conditional write: only the first racer sets the id; a loser re-reads it.
  const res = await prisma.store.updateMany({
    where: { id: storeId, stripeCustomerId: null },
    data: { stripeCustomerId: customer.id },
  });
  if (res.count === 0) {
    const winner = await prisma.store.findUniqueOrThrow({
      where: { id: storeId },
      select: { stripeCustomerId: true },
    });
    return winner.stripeCustomerId ?? customer.id;
  }
  return customer.id;
}

/** Stripe Checkout session to subscribe to a plan. */
export async function createCheckout(planKey: PlanKey) {
  if (!stripe) throw new ApiError(503, 'Billing is not configured', 'BILLING_DISABLED');
  const plan = PLANS[planKey];
  if (!plan?.priceId) throw ApiError.badRequest('That plan is not configured');
  const storeId = await getDefaultStoreId();
  const customer = await ensureCustomer(storeId);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: `${config.billing.appUrl}/admin/billing?status=success`,
    cancel_url: `${config.billing.appUrl}/admin/billing?status=cancelled`,
    subscription_data: { metadata: { storeId } },
  });
  return { url: session.url };
}

/** Stripe Billing Portal session to manage an existing subscription. */
export async function createPortal() {
  if (!stripe) throw new ApiError(503, 'Billing is not configured', 'BILLING_DISABLED');
  const storeId = await getDefaultStoreId();
  const customer = await ensureCustomer(storeId);
  const session = await stripe.billingPortal.sessions.create({
    customer,
    return_url: `${config.billing.appUrl}/admin/billing`,
  });
  return { url: session.url };
}

const STATUS_MAP: Record<string, BillingStatus> = {
  trialing: 'TRIALING',
  active: 'ACTIVE',
  // Grace ONLY for a previously-paid subscription whose renewal is retrying.
  past_due: 'PAST_DUE',
  // Never paid (declined first invoice) or dunning exhausted → no access.
  incomplete: 'CANCELED',
  incomplete_expired: 'CANCELED',
  unpaid: 'CANCELED',
  canceled: 'CANCELED',
};

function priceToPlan(priceId?: string | null): string | null {
  if (!priceId) return null;
  if (priceId === config.billing.prices.basic) return 'basic';
  if (priceId === config.billing.prices.pro) return 'pro';
  return null;
}

async function storeIdByCustomer(customerId: string): Promise<string | null> {
  const s = await prisma.store.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return s?.id ?? null;
}

/** The subset of a Stripe Subscription we persist (decoupled from the SDK's type exports). */
export interface StripeSubscriptionLike {
  id: string;
  status: string;
  customer: string | { id: string };
  metadata?: Record<string, string> | null;
  items: { data: Array<{ price: { id: string }; current_period_end?: number | null }> };
  current_period_end?: number | null;
}

/** Sync a Stripe subscription's state onto the owning Store (called by the webhook). */
export async function handleSubscriptionEvent(sub: StripeSubscriptionLike): Promise<void> {
  // Prefer the customer relationship of record; fall back to the (server-set)
  // metadata. Warn if they disagree (e.g. a duplicate/hand-edited customer).
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const byCustomer = await storeIdByCustomer(customerId);
  const byMetadata = sub.metadata?.storeId as string | undefined;
  if (byCustomer && byMetadata && byCustomer !== byMetadata) {
    logger.warn(
      { subscription: sub.id, byCustomer, byMetadata },
      'subscription storeId mismatch — using customer',
    );
  }
  const storeId = byCustomer ?? byMetadata;
  if (!storeId) {
    logger.warn({ subscription: sub.id }, 'stripe subscription event for unknown store');
    return;
  }
  // Stripe API >= 2025-03-31.basil moved `current_period_end` off the subscription
  // root onto its items. Read the item first, fall back to the (legacy) root so we
  // stay correct across API versions.
  const periodEndUnix = sub.current_period_end ?? sub.items.data[0]?.current_period_end ?? null;
  await prisma.store.update({
    where: { id: storeId },
    data: {
      stripeSubscriptionId: sub.id,
      subscriptionStatus: STATUS_MAP[sub.status] ?? 'PAST_DUE',
      plan: priceToPlan(sub.items.data[0]?.price.id),
      currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
    },
  });
}
