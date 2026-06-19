import type { Request, Response } from 'express';

import { stripe } from '../../lib/stripe';
import { config } from '../../config/env';
import { logger } from '../../lib/logger';
import { handleSubscriptionEvent, type StripeSubscriptionLike } from './billing.service';

/**
 * Stripe webhook. Mounted with express.raw (NOT json) so the signature can be
 * verified against the exact bytes Stripe signed.
 */
export async function stripeWebhook(req: Request, res: Response): Promise<void> {
  if (!stripe || !config.billing.webhookSecret) {
    res.status(503).json({ error: 'billing not configured' });
    return;
  }
  const signature = req.header('stripe-signature');
  if (!signature) {
    res.status(400).json({ error: 'missing signature' });
    return;
  }

  let event: { type: string; data: { object: unknown } };
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      signature,
      config.billing.webhookSecret,
    );
  } catch (err) {
    logger.warn({ err }, 'stripe webhook signature verification failed');
    res.status(400).json({ error: 'invalid signature' });
    return;
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionEvent(event.data.object as StripeSubscriptionLike);
        break;
      default:
        break;
    }
  } catch (err) {
    logger.error({ err, type: event.type }, 'stripe webhook handler error');
    res.status(500).json({ error: 'handler error' });
    return;
  }

  res.json({ received: true });
}
