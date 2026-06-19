import request from 'supertest';

import { createApp } from '../src/app';

// One in-process app instance per test file (supertest needs no open port).
export const app = createApp();
export const api = () => request(app);

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
  const res = await api().post('/api/admin/auth/login').send({ email, password });
  return res.body?.data as { token: string; user: { id: string; email: string; storeId: string } };
}

/** Register a fresh tenant; returns the request status + the body sent + response data. */
export async function registerTenant(
  overrides: Partial<{ restaurantName: string; email: string; password: string }> = {},
) {
  const tag = uid();
  const body = {
    restaurantName: overrides.restaurantName ?? `Test Cafe ${tag}`,
    email: overrides.email ?? `owner_${tag}@test.local`,
    password: overrides.password ?? 'password12345',
  };
  const res = await api().post('/api/admin/auth/register').send(body);
  return {
    status: res.status,
    body,
    data: res.body?.data as { token: string; user: { id: string; storeId: string } },
  };
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
