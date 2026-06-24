import { prisma } from '../../lib/prisma';
import { getCurrentCatalogueId, getDefaultStoreId } from '../../lib/store';
import { resolveEntitlementsForStore } from '../../lib/entitlements';

/**
 * The current tenant's effective entitlements + live usage, for the admin UI to
 * lock gated features and show limit usage ("8 / 10 tables"). An active trial
 * resolves to full Pro. Not subscription-gated, so the locked state is always
 * readable even when the subscription has lapsed.
 */
export async function getEntitlementsState() {
  const storeId = await getDefaultStoreId();
  const catalogueId = await getCurrentCatalogueId();
  const ent = await resolveEntitlementsForStore(storeId);
  const [tables, menuItems] = await Promise.all([
    prisma.table.count({ where: { storeId } }),
    // Menu items are counted per CATALOGUE (matching createItem's limit check) so
    // a brand's shared menu isn't double-counted once per outlet. Tables stay
    // per-store (each outlet has its own floor).
    prisma.menuItem.count({ where: { catalogueId } }),
  ]);
  return {
    tier: ent.tier,
    isTrial: ent.isTrial,
    features: [...ent.features],
    limits: ent.limits,
    usage: { tables, menuItems },
  };
}
