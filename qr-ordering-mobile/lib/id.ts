// A best-effort UUID. `crypto.randomUUID` is only defined in secure contexts
// (https or localhost); on a plain-http LAN/kiosk origin or an old in-app
// webview it can be undefined and throw. Fall back to a timestamp+random id so
// add-to-cart / order submission never crash on those deployments.
export function safeUuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
