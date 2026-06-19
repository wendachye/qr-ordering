import { prisma } from './prisma';

// The single source of truth for what each subscription tier unlocks. Plan
// definitions live in the DB (editable by a platform super-admin), but we keep
// built-in DEFAULTS so the system is correct even before the seed runs / a row
// is created — the DB row, when present, overrides the default for its key.

export type FeatureKey = 'loyalty' | 'vouchers' | 'reports_advanced' | 'tax_multi';
export const ALL_FEATURES: FeatureKey[] = ['loyalty', 'vouchers', 'reports_advanced', 'tax_multi'];

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  loyalty: 'Loyalty program',
  vouchers: 'Vouchers / promo codes',
  reports_advanced: 'Advanced reports',
  tax_multi: 'Multiple taxes + service charge',
};

export type PlanKey = 'basic' | 'pro';

export type PlanDef = {
  key: PlanKey;
  name: string;
  description: string | null;
  monthlyPrice: number;
  currency: string;
  stripePriceId: string | null;
  features: string[];
  maxTables: number | null; // null = unlimited
  maxMenuItems: number | null; // null = unlimited
  sortOrder: number;
  isActive: boolean;
};

export const DEFAULT_PLANS: Record<PlanKey, PlanDef> = {
  basic: {
    key: 'basic',
    name: 'Basic',
    description: 'Everything to run a small restaurant — menu, tables, POS and daily totals.',
    monthlyPrice: 0,
    currency: 'MYR',
    stripePriceId: null,
    features: [],
    maxTables: 10,
    maxMenuItems: 50,
    sortOrder: 0,
    isActive: true,
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    description: 'Loyalty, vouchers, full analytics, multi-tax and unlimited scale.',
    monthlyPrice: 0,
    currency: 'MYR',
    stripePriceId: null,
    features: [...ALL_FEATURES],
    maxTables: null,
    maxMenuItems: null,
    sortOrder: 1,
    isActive: true,
  },
};

export const PLAN_KEYS: PlanKey[] = ['basic', 'pro'];

// Normalise a stored plan key: legacy 'starter' → 'basic'; unknown/null → 'basic'.
export function normalizePlanKey(plan: string | null | undefined): PlanKey {
  const k = (plan ?? '').toLowerCase();
  if (k === 'pro') return 'pro';
  return 'basic';
}

type PlanRow = {
  key: string;
  name: string;
  description: string | null;
  monthlyPrice: unknown;
  currency: string;
  stripePriceId: string | null;
  features: unknown;
  maxTables: number | null;
  maxMenuItems: number | null;
  sortOrder: number;
  isActive: boolean;
};

// A DB row overrides the built-in default for its key.
function planFromRow(row: PlanRow | null, key: PlanKey): PlanDef {
  const def = DEFAULT_PLANS[key];
  if (!row) return def;
  return {
    key,
    name: row.name || def.name,
    description: row.description,
    monthlyPrice: Number(row.monthlyPrice),
    currency: row.currency || def.currency,
    stripePriceId: row.stripePriceId,
    features: Array.isArray(row.features) ? (row.features as string[]) : def.features,
    maxTables: row.maxTables,
    maxMenuItems: row.maxMenuItems,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

export async function getPlan(key: PlanKey): Promise<PlanDef> {
  const row = await prisma.plan.findUnique({ where: { key } });
  return planFromRow(row, key);
}

// All canonical plans (basic, pro), DB rows over defaults, ascending sortOrder.
export async function listPlanDefs(): Promise<PlanDef[]> {
  const rows = await prisma.plan.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return PLAN_KEYS.map((k) => planFromRow(byKey.get(k) ?? null, k)).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

// Find the plan key whose configured Stripe price matches (for the webhook).
export async function planKeyForPrice(priceId: string | null | undefined): Promise<PlanKey | null> {
  if (!priceId) return null;
  for (const p of await listPlanDefs()) {
    if (p.stripePriceId && p.stripePriceId === priceId) return p.key;
  }
  return null;
}

export type Entitlements = {
  tier: PlanKey;
  isTrial: boolean;
  features: Set<string>;
  limits: { maxTables: number | null; maxMenuItems: number | null };
};

function trialActive(store: { subscriptionStatus: string; trialEndsAt: Date | null }): boolean {
  return (
    store.subscriptionStatus === 'TRIALING' &&
    (!store.trialEndsAt || store.trialEndsAt.getTime() > Date.now())
  );
}

// Resolve a store's effective entitlements. An ACTIVE trial grants full Pro;
// otherwise the store's plan key (legacy 'starter' → 'basic') drives it.
export async function resolveEntitlements(store: {
  plan: string | null;
  subscriptionStatus: string;
  trialEndsAt: Date | null;
}): Promise<Entitlements> {
  const isTrial = trialActive(store);
  const key: PlanKey = isTrial ? 'pro' : normalizePlanKey(store.plan);
  const plan = await getPlan(key);
  return {
    tier: key,
    isTrial,
    features: new Set(plan.features),
    limits: { maxTables: plan.maxTables, maxMenuItems: plan.maxMenuItems },
  };
}

export async function resolveEntitlementsForStore(storeId: string): Promise<Entitlements> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { plan: true, subscriptionStatus: true, trialEndsAt: true },
  });
  if (!store)
    return { tier: 'basic', isTrial: false, features: new Set(), limits: DEFAULT_PLANS.basic };
  return resolveEntitlements({
    plan: store.plan,
    subscriptionStatus: store.subscriptionStatus,
    trialEndsAt: store.trialEndsAt,
  });
}

export function hasFeature(ent: Entitlements, f: string): boolean {
  return ent.features.has(f);
}
