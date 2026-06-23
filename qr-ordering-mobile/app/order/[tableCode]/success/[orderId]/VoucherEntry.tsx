"use client";

import { useState } from "react";
import { Button } from "@/components/common/Button";
import { applyVoucher, ApiError } from "@/lib/api";
import { formatPrice } from "@/lib/currency";

/**
 * Lets a customer apply a voucher code to their open tab from the order-success
 * screen. The code is validated + attached server-side; the discount is realised
 * when staff settle the bill.
 */
export function VoucherEntry({ tableCode }: { tableCode: string }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<{ code: string; estimatedDiscount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const c = code.trim();
    if (!c || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await applyVoucher(tableCode, c);
      setApplied({ code: res.code, estimatedDiscount: res.estimatedDiscount });
      setCode("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't apply that code.");
    } finally {
      setBusy(false);
    }
  };

  if (applied) {
    return (
      <div
        role="status"
        className="w-full max-w-xs rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3 text-center"
      >
        <p className="text-sm font-bold text-black">Voucher {applied.code} applied 🎉</p>
        <p className="mt-0.5 text-sm text-gray-600">
          {applied.estimatedDiscount > 0
            ? `About ${formatPrice(applied.estimatedDiscount)} off`
            : "Discount applied"}{" "}
          — your server will take it off when you settle the bill.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xs text-left">
      <p className="mb-1.5 text-center text-sm font-medium text-gray-700">Have a voucher?</p>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          aria-label="Voucher code"
          placeholder="Enter code"
          className="min-w-0 flex-1 rounded-xl border border-gray-300 px-3 py-2.5 font-mono text-sm uppercase tracking-wide outline-none focus:border-accent"
        />
        <Button onClick={submit} disabled={busy || !code.trim()}>
          {busy ? "…" : "Apply"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
