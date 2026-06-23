// Typed fetch helpers for the Public (customer) endpoints.
// Unwraps the { success, data } envelope and throws error.message on failure.

import type {
  CreateOrderRequest,
  CreatedOrder,
  MenuResponse,
  OpenTab,
  TableValidation,
} from "./types";
import { safeUuid } from "./id";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

// Abort a request that hasn't responded in this window so a hung connection
// (flaky venue Wi-Fi) surfaces as a retryable network error instead of pinning
// the loader / "Submitting…" forever.
const REQUEST_TIMEOUT_MS = 15_000;

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
  // A timeout signal, merged with any caller-supplied signal. An abort (timeout
  // or disconnect) lands in the catch below as a status-0 network error.
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
      signal,
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

/** GET /public/tables/:tableCode/tab — the table's current open tab (orders so far). */
export function getTab(tableCode: string): Promise<OpenTab> {
  return request<OpenTab>(
    `/public/tables/${encodeURIComponent(tableCode)}/tab`
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

// A settled tab's diner-facing receipt (GET /public/receipt/:id).
export type Receipt = {
  receiptNumber: number;
  storeName: string;
  logoUrl: string | null;
  tableName: string;
  pax: number | null;
  openedAt: string;
  closedAt: string | null;
  charges: { serviceChargeRate: number; taxes: { name: string; rate: number }[] };
  items: { name: string; quantity: number; unitPrice: number; totalPrice: number }[];
  subtotal: number;
  serviceCharge: number;
  taxes: { name: string; rate: number; amount: number }[];
  totalTax: number;
  discount: number;
  voucherCode: string | null;
  voucherDiscount: number;
  net: number;
  tip: number;
  total: number;
  payments: { method: string; amount: number; tip: number; tendered: number | null }[];
  change: number;
  paymentMethod: string | null;
};

/** GET /public/receipt/:id — the receipt for a settled tab. */
export function getReceipt(id: string): Promise<Receipt> {
  return request<Receipt>(`/public/receipt/${encodeURIComponent(id)}`);
}

/** A unique key for de-duplicating an order submission (server-side idempotency). */
export function newIdempotencyKey(): string {
  return safeUuid();
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
