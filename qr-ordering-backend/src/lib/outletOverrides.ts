import { prisma } from './prisma';

/**
 * A single outlet's overrides for a catalogue item on a shared brand catalogue.
 * Each field is null when the outlet inherits the catalogue value.
 */
export interface OutletState {
  priceOverride: number | null;
  isAvailableOverride: boolean | null; // per-outlet sold-out / 86
  isActiveOverride: boolean | null; // per-outlet "offered here?" (false = hide here)
}

/**
 * Per-outlet overrides for a set of catalogue items at one outlet, keyed by
 * menuItemId. An absent entry means "inherit everything from the catalogue".
 * Used by the customer/POS menu (display), order pricing + availability, and the
 * admin item list so they never disagree. (storeId = the resolving outlet.)
 */
export async function outletStateMap(
  storeId: string,
  menuItemIds: string[],
): Promise<Map<string, OutletState>> {
  if (menuItemIds.length === 0) return new Map();
  const rows = await prisma.menuItemOutletState.findMany({
    where: { storeId, menuItemId: { in: menuItemIds } },
    select: {
      menuItemId: true,
      priceOverride: true,
      isAvailableOverride: true,
      isActiveOverride: true,
    },
  });
  return new Map(
    rows.map((r) => [
      r.menuItemId,
      {
        priceOverride: r.priceOverride != null ? Number(r.priceOverride) : null,
        isAvailableOverride: r.isAvailableOverride,
        isActiveOverride: r.isActiveOverride,
      },
    ]),
  );
}

/** Resolve an item's effective base price at an outlet (override ?? catalogue). */
export function effectivePrice(state: OutletState | undefined, cataloguePrice: number): number {
  return state?.priceOverride ?? cataloguePrice;
}

/** Effective sold-out/availability at an outlet (override wins, else catalogue). */
export function effectiveAvailable(
  state: OutletState | undefined,
  catalogueAvailable: boolean,
): boolean {
  return state?.isAvailableOverride ?? catalogueAvailable;
}

/**
 * Whether a catalogue item is offered at an outlet: it must be active in the
 * catalogue AND not explicitly hidden by the outlet (isActiveOverride === false).
 * An outlet can opt OUT of a catalogue item but not opt into an archived one.
 */
export function offeredAtOutlet(state: OutletState | undefined, catalogueActive: boolean): boolean {
  return catalogueActive && state?.isActiveOverride !== false;
}
