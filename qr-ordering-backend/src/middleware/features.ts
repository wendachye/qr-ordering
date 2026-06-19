import type { NextFunction, Request, Response } from 'express';

import { currentStoreId } from '../lib/tenant';
import {
  featureLockedError,
  hasFeature,
  resolveEntitlementsForStore,
  type FeatureKey,
} from '../lib/entitlements';

/**
 * Blocks a feature router when the tenant's plan doesn't include it. Must run
 * AFTER requireAdmin (which establishes the tenant context) — typically as the
 * third guard after requireActiveSubscription. An ACTIVE trial resolves to full
 * Pro, so trialing tenants pass every gate.
 */
export function requireFeature(feature: FeatureKey) {
  return async (_req: Request, _res: Response, next: NextFunction) => {
    const ent = await resolveEntitlementsForStore(currentStoreId());
    if (!hasFeature(ent, feature)) throw featureLockedError(feature);
    next();
  };
}
