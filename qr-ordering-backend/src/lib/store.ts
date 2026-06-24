import { prisma } from './prisma';
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

/**
 * The menu Catalogue the current admin's store draws from. The menu is migrating
 * from per-store to a shared brand catalogue (a brand's outlets can point at one
 * catalogue); new menu rows are stamped with this so the link stays consistent
 * ahead of the read-switch. Returns null only for a store not yet provisioned with
 * a catalogue (every store gets one — see registerStore / provisionOutlet).
 */
export async function getCurrentCatalogueId(): Promise<string | null> {
  const store = await prisma.store.findUnique({
    where: { id: currentStoreId() },
    select: { catalogueId: true },
  });
  return store?.catalogueId ?? null;
}
