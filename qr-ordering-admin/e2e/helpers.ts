import { expect, type APIRequestContext, type Page } from "@playwright/test";

// Shared E2E helpers for the QR-ordering specs.

export const ADMIN_BASE = "http://localhost:3001";
export const MOBILE_BASE = "http://localhost:3000";
export const API_BASE = "http://localhost:4000/api/v1";

// Demo owner seeded in the dev DB.
export const OWNER_EMAIL = "klcc@demofnb.test";
export const OWNER_PASSWORD = "password123";

const TOKEN_KEY = "qr_admin_token";

// Unwrap the backend's { success, data } envelope.
async function apiData<T>(res: { ok(): boolean; status(): number; json(): Promise<unknown> }): Promise<T> {
  if (!res.ok()) {
    throw new Error(`API request failed (${res.status()})`);
  }
  const payload = (await res.json()) as { data?: T };
  return payload.data as T;
}

// Log into the backend over HTTP and return a bearer token. Used to seed admin
// auth (localStorage) without driving the UI, and to query the floor.
export async function apiLogin(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE}/admin/auth/login`, {
    data: { email: OWNER_EMAIL, password: OWNER_PASSWORD },
  });
  const data = await apiData<{ token: string }>(res);
  if (!data?.token) throw new Error("Login succeeded but no token was returned");
  return data.token;
}

type FloorEntry = {
  table: { id: string; name: string; code: string; isActive: boolean };
  session: { id: string } | null;
};

// Pick a FREE active table's code (entry.session === null) for a clean order.
// Throws a clear message if the floor has no free table so the failure is
// actionable rather than a mysterious selector timeout.
export async function getFreeTableCode(request: APIRequestContext): Promise<string> {
  const token = await apiLogin(request);
  const res = await request.get(`${API_BASE}/admin/floor`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const floor = await apiData<FloorEntry[]>(res);
  const free = floor.find((e) => e.session === null && e.table.isActive);
  if (!free) {
    throw new Error(
      "No free active table on the floor — every table is occupied. " +
        "Close a tab or re-seed the dev DB before running the mobile spec."
    );
  }
  return free.table.code;
}

// Look up the open session id for a given table code (or null if the table is
// free). Used to find the tab a mobile order opened so cleanup can cancel it.
export async function sessionIdForTableCode(
  request: APIRequestContext,
  tableCode: string
): Promise<string | null> {
  const token = await apiLogin(request);
  const res = await request.get(`${API_BASE}/admin/floor`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const floor = await apiData<FloorEntry[]>(res);
  const entry = floor.find((e) => e.table.code === tableCode);
  return entry?.session?.id ?? null;
}

// Extract the session id from a running-tab URL (/admin/sessions/<id>).
export function sessionIdFromUrl(url: string): string | null {
  const m = url.match(/\/admin\/sessions\/([^/?#]+)/);
  return m ? m[1] : null;
}

// Cancel a session created during a test so the table is freed again. Keeps the
// suite idempotent and re-runnable (it cleans up only the tabs it opened). Best
// effort: never throws, so a cleanup hiccup can't fail an otherwise-green test.
export async function cancelSession(
  request: APIRequestContext,
  sessionId: string
): Promise<void> {
  try {
    const token = await apiLogin(request);
    await request.post(`${API_BASE}/admin/sessions/${sessionId}/cancel`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Swallow — cleanup is best-effort.
  }
}

// Log into the admin SPA. The app stores a JWT in localStorage (no cookies), so
// the most robust path is: fetch a token via the API, inject it before the app
// boots, then land directly on the floor. This avoids racing the login form's
// client-side redirect on a cold dev server.
export async function loginAdmin(page: Page): Promise<void> {
  const token = await apiLogin(page.request);
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [TOKEN_KEY, token] as const
  );
  await page.goto(`${ADMIN_BASE}/admin/tables`);
  // Auth resolves client-side; once it does we're on the floor. The grid renders
  // a tile per table — each carries a "Manage <table>" menu button — so wait for
  // the first one rather than a page heading (the floor page has none).
  await expect(page).toHaveURL(/\/admin\/tables/, { timeout: 60_000 });
  await expect(
    page.getByRole("button", { name: /^Manage / }).first()
  ).toBeVisible({ timeout: 60_000 });
}
