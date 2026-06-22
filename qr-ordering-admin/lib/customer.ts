// Helpers for the customer-facing ordering site (used to print table QR/links).

// Base URL of the customer ordering app. Configurable via env; defaults to :3000.
export const CUSTOMER_BASE_URL =
  process.env.NEXT_PUBLIC_CUSTOMER_BASE_URL ?? "http://localhost:3000";

// The link a customer scans/opens for a given table code.
export function customerOrderLink(code: string): string {
  return `${CUSTOMER_BASE_URL.replace(/\/+$/, "")}/order/${code}`;
}

// The diner-facing receipt link for a settled tab (session id).
export function customerReceiptLink(sessionId: string): string {
  return `${CUSTOMER_BASE_URL.replace(/\/+$/, "")}/receipt/${sessionId}`;
}
