import { prisma } from '../../lib/prisma';
import { getDefaultStoreId } from '../../lib/store';
import { resolveEntitlementsForStore } from '../../lib/entitlements';

/**
 * The current tenant's effective entitlements + live usage, for the admin UI to
 * lock gated features and show limit usage ("8 / 10 tables"). An active trial
 * resolves to full Pro. Not subscription-gated, so the locked state is always
 * readable even when the subscription has lapsed.
 */
export async function getEntitlementsState() {
  const storeId = await getDefaultStoreId();
  const ent = await resolveEntitlementsForStore(storeId);
  const [tables, menuItems] = await Promise.all([
    prisma.table.count({ where: { storeId } }),
    prisma.menuItem.count({ where: { storeId } }),
  ]);
  return {
    tier: ent.tier,
    isTrial: ent.isTrial,
    features: [...ent.features],
    limits: ent.limits,
    usage: { tables, menuItems },
  };
}
