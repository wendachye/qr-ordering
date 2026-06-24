import { prisma } from './prisma';

/**
 * Per-outlet price overrides for a set of catalogue items at one outlet.
 *
 * On a shared brand catalogue an outlet can set its own base price for an item
 * (MenuItemOutletState.priceOverride) without forking the catalogue. Returns a
 * Map of menuItemId → override price (number); an absent entry means "inherit the
 * catalogue price". Used by both the customer/POS menu (display) and order
 * pricing so the two never disagree. (storeId = the resolving outlet.)
 */
export async function outletPriceMap(
  storeId: string,
  menuItemIds: string[],
): Promise<Map<string, number>> {
  if (menuItemIds.length === 0) return new Map();
  const rows = await prisma.menuItemOutletState.findMany({
    where: { storeId, menuItemId: { in: menuItemIds }, priceOverride: { not: null } },
    select: { menuItemId: true, priceOverride: true },
  });
  return new Map(rows.map((r) => [r.menuItemId, Number(r.priceOverride)]));
}
