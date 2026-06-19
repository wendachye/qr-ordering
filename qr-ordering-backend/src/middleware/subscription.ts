import type { NextFunction, Request, Response } from 'express';

import { ApiError } from '../lib/response';
import { currentStoreId } from '../lib/tenant';
import { isStoreBillingActive } from '../modules/billing/billing.service';

/**
 * Blocks operational admin routes when the tenant's subscription is inactive
 * (trial expired or canceled). Must run AFTER requireAdmin, which establishes
 * the tenant context. The account area — auth, billing, and settings — is
 * intentionally NOT gated, so an unsubscribed tenant can manage their account
 * and subscribe.
 */
export async function requireActiveSubscription(_req: Request, _res: Response, next: NextFunction) {
  const storeId = currentStoreId();
  if (!(await isStoreBillingActive(storeId))) {
    throw new ApiError(
      402,
      'Your subscription is inactive — please subscribe to continue.',
      'SUBSCRIPTION_INACTIVE',
    );
  }
  next();
}
