import request from 'supertest';

import { createApp } from '../src/app';
import { registerStore } from '../src/modules/auth/auth.service';

// One in-process app instance per test file (supertest needs no open port).
export const app = createApp();

// All feature APIs live under a single versioned prefix. Tests call version-less
// paths (e.g. `/admin/auth/login`) and this wrapper prepends the prefix, so a
// future bump (`/api/v2`) is a one-line change here — not a sweep across every
// test. Non-feature paths (`/health`, `/metrics`, `/api/stripe/webhook`) and any
// already-prefixed path pass through untouched.
export const API_PREFIX = '/api/v1';
const FEATURE_ROOT = /^\/(public|orders|admin|print-agent)(\/|\?|$)/;
const withPrefix = (path: string) => (FEATURE_ROOT.test(path) ? `${API_PREFIX}${path}` : path);

export const api = () => {
  const agent = request(app);
  return {
    get: (path: string) => agent.get(withPrefix(path)),
    post: (path: string) => agent.post(withPrefix(path)),
    put: (path: string) => agent.put(withPrefix(path)),
    patch: (path: string) => agent.patch(withPrefix(path)),
    delete: (path: string) => agent.delete(withPrefix(path)),
  };
};

let seq = 0;
/** A short, unique suffix for isolated test data (emails, slugs, …). */
export function uid(): string {
  seq += 1;
  return `${process.hrtime.bigint().toString(36).slice(-6)}${seq}`;
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function login(email: string, password: string) {
  const res = await api().post('/admin/auth/login').send({ email, password });
  return res.body?.data as { token: string; user: { id: string; email: string; storeId: string } };
}

/**
 * Provision a fresh tenant for a test; returns the body used + the resulting
 * token/user. There is no public signup route (the super-admin creates tenants),
 * so this calls the same provisioning primitive in-process — every test still
 * gets an isolated tenant with the standard starter workspace.
 */
export async function registerTenant(
  overrides: Partial<{ restaurantName: string; email: string; password: string }> = {},
) {
  const tag = uid();
  const body = {
    restaurantName: overrides.restaurantName ?? `Test Cafe ${tag}`,
    email: overrides.email ?? `owner_${tag}@test.local`,
    password: overrides.password ?? 'password12345',
  };
  const data = await registerStore(body);
  return { body, data };
}

/**
 * Pick a deterministic orderable line: the first available item with NO required
 * option groups, so tests don't silently depend on the seed's category/item
 * ordering or option configuration.
 */
export function firstOrderable(menu: any): {
  menuItemId: string;
  quantity: number;
  optionChoiceIds: string[];
} {
  const item = menu.categories
    .flatMap((c: any) => c.items)
    .find((i: any) => i.isAvailable && !(i.optionGroups ?? []).some((g: any) => g.required));
  if (!item) throw new Error('No option-free menu item available to order');
  return { menuItemId: item.id, quantity: 1, optionChoiceIds: [] };
}
