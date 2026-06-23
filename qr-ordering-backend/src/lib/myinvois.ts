// Malaysia e-Invoice (MyInvois / LHDN) — document builder + a pluggable
// submission adapter.
//
// The "document" is a self-describing JSON snapshot of the invoice (seller,
// buyer, lines, taxes, totals) shaped to map cleanly onto the MyInvois UBL
// fields. The REAL LHDN submission needs the taxpayer's sandbox credentials +
// signing certificate (which only the operator can provision), so the default
// adapter is a sandbox STUB that simulates a successful submission. A real
// adapter plugs in at getSubmissionAdapter() with no change to callers.

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface InvoiceParty {
  name: string | null;
  tin: string | null;
  registrationNo: string | null;
  sstNo?: string | null;
  msic?: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceMoney {
  currency: string;
  subtotal: number;
  serviceCharge: number;
  taxes: { name: string; rate: number; amount: number }[];
  taxTotal: number;
  total: number; // tax-inclusive payable (net of discounts, excl. gratuity)
  allowance: number; // bill-level discounts (discount + voucher), positive amount
}

export interface MyInvoisDocument {
  type: 'Invoice';
  version: '1.0';
  invoiceNumber: string;
  issuedAt: string;
  currency: string;
  supplier: InvoiceParty;
  buyer: InvoiceParty;
  lines: InvoiceLine[];
  legalMonetaryTotal: {
    lineExtensionAmount: number;
    allowanceTotalAmount: number;
    taxExclusiveAmount: number;
    taxInclusiveAmount: number;
    payableAmount: number;
  };
  taxTotal: { taxAmount: number; subtotals: { name: string; rate: number; amount: number }[] };
}

export function buildMyInvoisDocument(args: {
  invoiceNumber: string;
  issuedAt: Date;
  supplier: InvoiceParty;
  buyer: InvoiceParty;
  lines: InvoiceLine[];
  money: InvoiceMoney;
}): MyInvoisDocument {
  const { money } = args;
  const taxExclusive = round2(money.subtotal + money.serviceCharge);
  // lines[].amount are tax-INCLUSIVE gross line totals (this system prices
  // tax-inclusively); lineExtensionAmount is their sum so the line detail
  // reconciles, and bill-level discounts are carried as allowanceTotalAmount. A
  // production LHDN adapter must convert these into tax-exclusive UBL lines with
  // a per-line TaxSubtotal + an AllowanceCharge before signing/submitting.
  const lineExtension = round2(args.lines.reduce((sum, l) => sum + l.amount, 0));
  return {
    type: 'Invoice',
    version: '1.0',
    invoiceNumber: args.invoiceNumber,
    issuedAt: args.issuedAt.toISOString(),
    currency: money.currency,
    supplier: args.supplier,
    buyer: args.buyer,
    lines: args.lines,
    legalMonetaryTotal: {
      lineExtensionAmount: lineExtension,
      allowanceTotalAmount: round2(money.allowance),
      taxExclusiveAmount: taxExclusive,
      taxInclusiveAmount: round2(money.total),
      payableAmount: round2(money.total),
    },
    taxTotal: {
      taxAmount: round2(money.taxTotal),
      subtotals: money.taxes.map((t) => ({ name: t.name, rate: t.rate, amount: t.amount })),
    },
  };
}

// --- Submission adapter (pluggable) ---

export interface SubmissionResult {
  submissionUid: string;
  longId: string;
  validationUrl: string;
  qrCode: string;
  status: 'valid' | 'submitted';
}

export interface SubmissionAdapter {
  submit(doc: MyInvoisDocument): Promise<SubmissionResult>;
}

// Small deterministic hash (no crypto dep) for synthetic sandbox identifiers.
function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).toUpperCase().padStart(8, '0');
}

// Sandbox stub: validates the document and returns synthetic identifiers, so the
// whole issue -> submit -> stored-UID/QR flow works end to end without real LHDN
// access. The validationUrl/qr mimic the MyInvois pre-production portal shape.
const sandboxAdapter: SubmissionAdapter = {
  async submit(doc) {
    if (!doc.supplier.tin) {
      throw new Error('Seller TIN is required before submitting an e-Invoice');
    }
    const uid = `SANDBOX-${doc.invoiceNumber}-${hash(doc.invoiceNumber)}`;
    const longId = hash(`${doc.invoiceNumber}:${doc.legalMonetaryTotal.payableAmount}`);
    const url = `https://preprod.myinvois.hasil.gov.my/${uid}`;
    return { submissionUid: uid, longId, validationUrl: url, qrCode: url, status: 'valid' };
  },
};

/**
 * The adapter for a store's e-Invoice mode. Production requires a real adapter
 * wired with the taxpayer's credentials + certificate; until that exists it is
 * intentionally unavailable (so an invoice is never silently "submitted" without
 * actually reaching LHDN).
 */
export function getSubmissionAdapter(mode: string): SubmissionAdapter {
  if (mode === 'production') {
    throw new Error(
      'Production MyInvois submission is not configured — add LHDN credentials + certificate',
    );
  }
  return sandboxAdapter;
}
