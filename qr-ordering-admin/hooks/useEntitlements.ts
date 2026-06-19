"use client";

import { useQuery } from "@tanstack/react-query";
import { entitlementsApi } from "@/lib/endpoints";

// The current tenant's resolved plan entitlements (features + limits + usage),
// for locking gated controls in the admin UI. An active trial resolves to full
// Pro, so trialing tenants never see a locked state.
export function useEntitlements() {
  const query = useQuery({
    queryKey: ["entitlements"],
    queryFn: entitlementsApi.get,
    staleTime: 60_000,
  });
  const ent = query.data;

  const remaining = (used: number, max: number | null) =>
    max == null ? null : Math.max(0, max - used);

  return {
    ent,
    isLoading: query.isLoading,
    // Default to "unlocked" until loaded, so a Pro tenant never flashes a locked
    // control. The backend 403 is the real backstop regardless.
    has: (feature: string) => !ent || ent.features.includes(feature),
    locked: (feature: string) => !!ent && !ent.features.includes(feature),
    limits: ent?.limits ?? { maxTables: null, maxMenuItems: null },
    usage: ent?.usage ?? { tables: 0, menuItems: 0 },
    tablesRemaining: ent ? remaining(ent.usage.tables, ent.limits.maxTables) : null,
    menuItemsRemaining: ent ? remaining(ent.usage.menuItems, ent.limits.maxMenuItems) : null,
  };
}
