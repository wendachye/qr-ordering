"use client";

import { useEffect, useState } from "react";
import { getReceipt, ApiError, type Receipt } from "@/lib/api";
import { assetUrl } from "@/lib/assets";
import { formatPrice } from "@/lib/currency";

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 ${
        strong ? "text-base font-bold text-slate-900" : "text-sm"
      } ${muted ? "text-slate-500" : "text-slate-700"}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function ReceiptView({ id }: { id: string }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getReceipt(id)
      .then((r) => active && setReceipt(r))
      .catch((e) =>
        active && setError(e instanceof ApiError ? e.message : "Could not load this receipt.")
      );
    return () => {
      active = false;
    };
  }, [id]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-bold text-slate-900">Receipt unavailable</p>
          <p className="mt-1 text-sm text-slate-500">{error}</p>
        </div>
      </main>
    );
  }

  if (!receipt) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <p className="text-sm text-slate-500">Loading receipt…</p>
      </main>
    );
  }

  const r = receipt;
  const closed = r.closedAt ? new Date(r.closedAt).toLocaleString() : "";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-sm">
        <div className="rounded-2xl bg-white p-6 shadow-sm print:rounded-none print:shadow-none">
          {/* Header */}
          <div className="border-b border-dashed border-slate-200 pb-4 text-center">
            {r.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assetUrl(r.logoUrl)}
                alt=""
                className="mx-auto mb-2 h-14 w-auto max-w-[60%] object-contain"
              />
            )}
            <h1 className="text-xl font-black tracking-tight text-slate-900">{r.storeName}</h1>
            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Tax Invoice
            </p>
          </div>

          {/* Meta */}
          <div className="space-y-1 border-b border-dashed border-slate-200 py-3 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>Receipt #</span>
              <span className="font-semibold text-slate-700">{r.receiptNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Table</span>
              <span className="font-semibold text-slate-700">
                {r.tableName}
                {r.pax ? ` · ${r.pax} pax` : ""}
              </span>
            </div>
            {closed && (
              <div className="flex justify-between">
                <span>Date</span>
                <span className="font-semibold text-slate-700">{closed}</span>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="space-y-2 border-b border-dashed border-slate-200 py-3">
            {r.items.map((it, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-slate-700">
                  <span className="font-semibold text-slate-900">{it.quantity}×</span> {it.name}
                </span>
                <span className="tabular-nums text-slate-700">{formatPrice(it.totalPrice)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-1.5 border-b border-dashed border-slate-200 py-3">
            <Row label="Subtotal" value={formatPrice(r.subtotal)} muted />
            {r.charges.serviceChargeRate > 0 && (
              <Row
                label={`Service charge (${r.charges.serviceChargeRate}%)`}
                value={formatPrice(r.serviceCharge)}
                muted
              />
            )}
            {r.taxes.map((t) => (
              <Row key={t.name} label={`${t.name} (${t.rate}%)`} value={formatPrice(t.amount)} muted />
            ))}
            {r.discount > 0 && (
              <Row label="Discount" value={`−${formatPrice(r.discount)}`} muted />
            )}
            {r.voucherDiscount > 0 && (
              <Row
                label={`Voucher${r.voucherCode ? ` (${r.voucherCode})` : ""}`}
                value={`−${formatPrice(r.voucherDiscount)}`}
                muted
              />
            )}
            <div className="pt-1">
              <Row label={r.tip > 0 ? "Net" : "Total"} value={formatPrice(r.net)} strong />
            </div>
            {r.tip > 0 && (
              <>
                <Row label="Tip" value={`+${formatPrice(r.tip)}`} muted />
                <Row label="Total" value={formatPrice(r.total)} strong />
              </>
            )}
          </div>

          {/* Tender */}
          <div className="space-y-1.5 py-3">
            {r.payments.map((p, i) => (
              <Row
                key={i}
                label={`Paid · ${p.method}${p.tip > 0 ? ` (incl. tip)` : ""}`}
                value={formatPrice(p.amount + p.tip)}
                muted
              />
            ))}
            {r.change > 0 && <Row label="Change" value={formatPrice(r.change)} muted />}
          </div>

          <p className="border-t border-dashed border-slate-200 pt-4 text-center text-xs text-slate-400">
            Thank you — please come again
          </p>
        </div>

        {/* Print — hidden when printing */}
        <div className="mt-4 flex justify-center print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
          >
            Print / Save as PDF
          </button>
        </div>
      </div>
    </main>
  );
}
