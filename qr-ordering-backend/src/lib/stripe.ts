import Stripe from 'stripe';

import { config } from '../config/env';

/** Stripe client, or null when STRIPE_SECRET_KEY is unset (billing disabled / dev). */
export const stripe = config.billing.stripeSecretKey
  ? new Stripe(config.billing.stripeSecretKey)
  : null;

// Subscription plans, mapped to their Stripe Price IDs (env fallback; the live
// price can be overridden per plan in the Plan table).
export const PLANS = {
  basic: { key: 'basic', name: 'Basic', priceId: config.billing.prices.basic },
  pro: { key: 'pro', name: 'Pro', priceId: config.billing.prices.pro },
} as const;

export type PlanKey = keyof typeof PLANS;
