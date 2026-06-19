// Typed fetch wrapper for the admin API.
// - injects the bearer token from localStorage
// - unwraps the { success, data } envelope
// - throws an ApiError carrying error.message on non-2xx
// - on 401 clears the token and redirects to /admin/login

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

const TOKEN_KEY = "qr_admin_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

/** A unique key for de-duplicating an order submission (server-side idempotency). */
export function newIdempotencyKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/admin/login") {
    window.location.assign("/admin/login");
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  // Skip the automatic redirect on 401 (used by the auth bootstrap / login).
  skipAuthRedirect?: boolean;
  // De-dupe order submissions — sent as the Idempotency-Key header.
  idempotencyKey?: string;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, skipAuthRedirect = false, idempotencyKey } = options;

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "Cannot reach the server. Is the backend running on :4000?",
      0
    );
  }

  if (res.status === 401) {
    clearToken();
    if (!skipAuthRedirect) redirectToLogin();
    throw new ApiError("Your session has expired. Please log in again.", 401);
  }

  // Subscription inactive (trial ended / canceled) — route the operator to billing.
  if (res.status === 402) {
    if (typeof window !== "undefined" && window.location.pathname !== "/admin/billing") {
      window.location.assign("/admin/billing");
    }
    throw new ApiError(
      "Your subscription is inactive. Please subscribe to continue.",
      402,
      "SUBSCRIPTION_INACTIVE"
    );
  }

  // Some endpoints (rare) may return 204; treat empty body as null.
  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiError("Received an invalid response from the server.", res.status);
    }
  }

  if (!res.ok) {
    const errObj =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as { error?: { message?: string; code?: string; details?: unknown } }).error
        : undefined;
    throw new ApiError(
      errObj?.message ?? `Request failed (${res.status}).`,
      res.status,
      errObj?.code,
      errObj?.details
    );
  }

  if (
    payload &&
    typeof payload === "object" &&
    "success" in payload &&
    "data" in payload
  ) {
    return (payload as { data: T }).data;
  }

  // Fallback: return the raw payload if it is not enveloped.
  return payload as T;
}

// Uploads a single image via multipart/form-data and returns its (relative) url.
// Uses fetch directly with a FormData body: we must NOT set Content-Type so the
// browser can add the multipart boundary. Mirrors apiRequest's 401 + envelope handling.
export async function uploadImage(file: File): Promise<string> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  // NOTE: intentionally no Content-Type header.

  const form = new FormData();
  form.append("file", file);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/admin/uploads/image`, {
      method: "POST",
      headers,
      body: form,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "Cannot reach the server. Is the backend running on :4000?",
      0
    );
  }

  if (res.status === 401) {
    clearToken();
    redirectToLogin();
    throw new ApiError("Your session has expired. Please log in again.", 401);
  }

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiError("Received an invalid response from the server.", res.status);
    }
  }

  if (!res.ok) {
    const errObj =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as { error?: { message?: string; code?: string; details?: unknown } }).error
        : undefined;
    throw new ApiError(
      errObj?.message ?? `Upload failed (${res.status}).`,
      res.status,
      errObj?.code,
      errObj?.details
    );
  }

  const data =
    payload &&
    typeof payload === "object" &&
    "success" in payload &&
    "data" in payload
      ? (payload as { data: unknown }).data
      : payload;

  const url =
    data && typeof data === "object" && "url" in data
      ? (data as { url?: unknown }).url
      : undefined;

  if (typeof url !== "string" || !url) {
    throw new ApiError("Upload succeeded but no url was returned.", res.status);
  }

  return url;
}
