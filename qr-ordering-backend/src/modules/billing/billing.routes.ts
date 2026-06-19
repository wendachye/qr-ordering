import { Router } from 'express';
import { z } from 'zod';

import { requireAdmin } from '../../middleware/auth';
import { sendOk } from '../../lib/response';
import { createCheckout, createPortal, getBillingState } from './billing.service';

export const billingRouter = Router();

// Authenticated but NOT subscription-gated — tenants must reach billing even
// when their subscription is inactive (that's how they fix it).
billingRouter.use(requireAdmin);

// GET /api/admin/billing — current plan / trial / subscription status.
billingRouter.get('/', async (_req, res) => {
  sendOk(res, await getBillingState());
});

// POST /api/admin/billing/checkout — Stripe Checkout URL for a plan.
billingRouter.post('/checkout', async (req, res) => {
  const { plan } = z.object({ plan: z.enum(['basic', 'pro']) }).parse(req.body);
  sendOk(res, await createCheckout(plan));
});

// POST /api/admin/billing/portal — Stripe Billing Portal URL.
billingRouter.post('/portal', async (_req, res) => {
  sendOk(res, await createPortal());
});
