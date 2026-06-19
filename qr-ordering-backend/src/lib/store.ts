import { currentStoreId } from './tenant';

/**
 * The store (tenant) the current admin request belongs to. Resolved from the
 * per-request tenant context that `requireAdmin` sets from the admin's JWT, so
 * every admin query is automatically scoped to the right tenant. Throws if
 * called outside an authenticated admin request.
 *
 * (Name kept for compatibility with existing call sites.)
 */
export async function getDefaultStoreId(): Promise<string> {
  return currentStoreId();
}
