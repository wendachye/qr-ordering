// Typed fetch helpers for the Public (customer) endpoints.
// Unwraps the { success, data } envelope and throws error.message on failure.

import type {
  CreateOrderRequest,
  CreatedOrder,
  MenuResponse,
  TableValidation,
} from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

type SuccessEnvelope<T> = { success: true; data: T };
type ErrorEnvelope = {
  success: false;
  error: { message: string; code?: string; details?: unknown };
};
type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

/**
 * Error thrown when the API returns a non-2xx response or a malformed body.
 * `status` is the HTTP status code (0 for network/parse errors).
 */
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "Unable to reach the server. Please check your connection.",
      0
    );
  }

  let body: Envelope<T> | null = null;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    body = null;
  }

  if (!res.ok || !body || body.success === false) {
    const message =
      body && body.success === false
        ? body.error.message
        : `Request failed (${res.status}).`;
    const code =
      body && body.success === false ? body.error.code : undefined;
    throw new ApiError(message, res.status, code);
  }

  return body.data;
}

/** GET /public/tables/:tableCode — validate a table. */
export function getTable(tableCode: string): Promise<TableValidation> {
  return request<TableValidation>(
    `/public/tables/${encodeURIComponent(tableCode)}`
  );
}

/** GET /public/menu?tableCode=... — load the menu for a table. */
export function getMenu(tableCode: string): Promise<MenuResponse> {
  return request<MenuResponse>(
    `/public/menu?tableCode=${encodeURIComponent(tableCode)}`
  );
}

export type AppliedVoucher = {
  code: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  estimatedDiscount: number;
};

/** POST /public/voucher — apply a voucher code to this table's open tab. */
export function applyVoucher(tableCode: string, code: string): Promise<AppliedVoucher> {
  return request<AppliedVoucher>(`/public/voucher`, {
    method: "POST",
    body: JSON.stringify({ tableCode, code }),
  });
}

/** A unique key for de-duplicating an order submission (server-side idempotency). */
export function newIdempotencyKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

/** POST /orders — submit an order. An Idempotency-Key de-dupes retries. */
export function createOrder(
  payload: CreateOrderRequest,
  idempotencyKey?: string
): Promise<CreatedOrder> {
  return request<CreatedOrder>(`/orders`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
}
