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
 * The menu Catalogue the current admin's store draws from. Menu reads/writes are
 * catalogue-scoped (a brand's outlets can share one catalogue). Every store is
 * provisioned with a catalogue (registerStore / provisionOutlet), so this throws
 * if one is somehow missing rather than silently mis-scoping the menu.
 */
export async function getCurrentCatalogueId(): Promise<string> {
  const store = await prisma.store.findUnique({
    where: { id: currentStoreId() },
    select: { catalogueId: true },
  });
  if (!store?.catalogueId) {
    throw new Error('Current store has no catalogue (provisioning gap)');
  }
  return store.catalogueId;
}
