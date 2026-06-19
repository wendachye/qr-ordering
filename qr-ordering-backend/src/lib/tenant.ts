import { AsyncLocalStorage } from 'node:async_hooks';

import { ApiError } from './response';

/**
 * Per-request tenant context. `requireAdmin` runs each authenticated request
 * inside `tenantStore.run({ storeId }, …)`, so any code down the call stack can
 * resolve the current tenant's store id without threading it through every
 * function signature. Public (customer) routes resolve their store from the
 * table code instead and never read this.
 */
export const tenantStore = new AsyncLocalStorage<{ storeId: string }>();

/** The current request's tenant store id. Throws if called outside an admin request. */
export function currentStoreId(): string {
  const ctx = tenantStore.getStore();
  if (!ctx?.storeId) {
    throw ApiError.unauthorized('No tenant context for this request');
  }
  return ctx.storeId;
}
