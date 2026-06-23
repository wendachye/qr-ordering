// Payment-capture seam.
//
// Settling a tab RECORDS a tender (method + amount). This interface is the single
// point where a real payment provider (gateway / card terminal / e-wallet) would
// actually CAPTURE the money. It mirrors the MyInvois submission adapter: the
// settlement flow calls getPaymentAdapter().capture(...) and never needs to know
// which provider is wired.
//
// The default adapter is "manual" — the venue captures out-of-band (cash drawer,
// a standalone bank EDC terminal, or a counter DuitNow/TnG/GrabPay QR) and the POS
// just records the tender. That is exactly today's behaviour. To go live with a
// real provider later, add an adapter to the registry below and select it via
// store/config — with no change to the settlement flow.

export interface CaptureInput {
  storeId: string;
  sessionId: string;
  method: string; // Cash, Visa, GrabPay, Touch 'n Go, …
  amount: number; // RM applied to the bill (2dp)
  tip: number; // gratuity (RM)
  tendered: number | null; // cash given, for change
  reference: string | null; // staff-entered approval code / ref, if any
}

export interface CaptureResult {
  status: 'captured' | 'pending' | 'failed';
  // Provider transaction id (stored on Payment.reference). The manual adapter
  // passes through any staff-entered reference.
  providerRef: string | null;
  message?: string;
}

export interface RefundInput {
  storeId: string;
  paymentId: string;
  amount: number;
  providerRef: string | null;
}

export interface RefundResult {
  status: 'refunded' | 'pending' | 'failed';
  providerRef: string | null;
  message?: string;
}

export interface PaymentAdapter {
  readonly key: string;
  capture(input: CaptureInput): Promise<CaptureResult>;
  refund(input: RefundInput): Promise<RefundResult>;
}

// Record-only. capture() is a no-op success — the money is handled out-of-band,
// exactly as the POS works today.
const manualAdapter: PaymentAdapter = {
  key: 'manual',
  async capture(input) {
    return { status: 'captured', providerRef: input.reference };
  },
  async refund(input) {
    // No gateway to reverse — refunds are handled out-of-band; surface the ref.
    return { status: 'refunded', providerRef: input.providerRef };
  },
};

// Provider registry. Add real adapters here (iPay88 / Billplz / eGHL / Fiuu /
// Stripe / DuitNow …), each implementing PaymentAdapter. Unknown / not-yet-built
// providers fail loudly rather than silently "succeeding".
const ADAPTERS: Record<string, PaymentAdapter> = {
  manual: manualAdapter,
};

/**
 * The adapter for a provider key (default 'manual'). When a real provider is
 * wired, store the chosen key on the store/config and pass it here.
 */
export function getPaymentAdapter(provider?: string | null): PaymentAdapter {
  const key = (provider ?? 'manual').toLowerCase();
  const adapter = ADAPTERS[key];
  if (!adapter) throw new Error(`Payment provider "${key}" is not configured`);
  return adapter;
}
