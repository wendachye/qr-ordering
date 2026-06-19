"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Lock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useSessionMutations } from "@/hooks/useSessionMutations";
import { settingsApi } from "@/lib/endpoints";
import { clearDraft } from "@/lib/draftCart";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { ChargeBreakdown } from "@/components/orders/ChargeBreakdown";
import type { DiscountType, SessionStatus } from "@/lib/types";

// Actions for an OPEN tab: Make payment (settle with a method + optional
// bill-level discount) / Cancel (void). The discount is PIN-gated, like a price
// override, and is computed authoritatively on the server at close.
export function SessionActions({
  sessionId,
  sessionNumber,
  status,
  total,
  paymentMethods,
  attachedVoucher,
}: {
  sessionId: string;
  sessionNumber: number;
  status: SessionStatus;
  total: number;
  paymentMethods: string[];
  // A voucher code a customer already applied to this tab (auto-applied at pay).
  attachedVoucher?: string | null;
}) {
  const { close, cancel } = useSessionMutations();
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Bill-level discount (PIN-gated).
  const [unlocked, setUnlocked] = useState(false);
  const [discountType, setDiscountType] = useState<"" | DiscountType>("");
  const [discountValue, setDiscountValue] = useState("");
  const [voucherInput, setVoucherInput] = useState("");
  const [pwOpen, setPwOpen] = useState(false);
  const [pwValue, setPwValue] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  // Whether discounts require the override PIN (store setting). Fail closed.
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });
  const discountPinRequired = settingsQuery.data?.discountPinRequired ?? true;

  const busy = close.isPending || cancel.isPending;
  if (status !== "OPEN") return null;

  // Discount controls are usable once unlocked, or freely when no PIN is required.
  const discountReady = unlocked || !discountPinRequired;
  const discountNum = Number(discountValue);
  const useDiscount =
    discountReady &&
    discountType !== "" &&
    discountValue.trim() !== "" &&
    !Number.isNaN(discountNum) &&
    discountNum > 0;
  const discountAmt = useDiscount
    ? Math.round(
        Math.min(
          discountType === "PERCENT"
            ? (total * Math.min(100, discountNum)) / 100
            : discountNum,
          total
        ) * 100
      ) / 100
    : 0;
  const net = Math.round((total - discountAmt) * 100) / 100;

  const resetDiscount = () => {
    setUnlocked(false);
    setDiscountType("");
    setDiscountValue("");
    setPwOpen(false);
    setPwValue("");
    setPwError(null);
  };

  const closePayDialog = () => {
    if (close.isPending) return;
    setPayOpen(false);
    setMethod(null);
    setVoucherInput("");
    resetDiscount();
  };

  const unlock = async () => {
    if (!pwValue) return;
    setPwBusy(true);
    setPwError(null);
    try {
      const res = await settingsApi.verifyPin(pwValue);
      if (res.ok) {
        setUnlocked(true);
        setPwOpen(false);
        setPwValue("");
      } else if (!res.configured) {
        setPwError("No override PIN set yet — add one in Settings.");
      } else {
        setPwError("Incorrect PIN.");
      }
    } catch {
      setPwError("Couldn't verify — please try again.");
    } finally {
      setPwBusy(false);
    }
  };

  const pay = () => {
    if (!method) return;
    const vc = voucherInput.trim();
    close.mutate(
      {
        id: sessionId,
        paymentMethod: method,
        discount: useDiscount
          ? { discountType: discountType as DiscountType, discountValue: discountNum }
          : undefined,
        // Blank → fall back to any customer-attached voucher on the tab.
        voucherCode: vc ? vc : undefined,
      },
      {
        onSuccess: () => {
          clearDraft(sessionId);
          setPayOpen(false);
          setMethod(null);
          setVoucherInput("");
          resetDiscount();
        },
      }
    );
  };

  return (
    <>
      <Button variant="success" disabled={busy} onClick={() => setPayOpen(true)}>
        <CreditCard />
        Make payment
      </Button>
      <Button variant="destructive" disabled={busy} onClick={() => setConfirmCancel(true)}>
        <XCircle />
        Cancel session
      </Button>

      <ModalDialog
        open={payOpen}
        onClose={closePayDialog}
        title={`Make payment — session #${sessionNumber}`}
      >
        <div className="space-y-4">
          {/* Amount summary (subtotal → discount → net) */}
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600">
                {useDiscount ? "Subtotal" : "Amount due"}
              </span>
              <span
                className={cn(
                  "font-black text-slate-900",
                  useDiscount ? "text-lg" : "text-2xl"
                )}
              >
                {formatPrice(total)}
              </span>
            </div>
            {useDiscount && (
              <>
                <div className="mt-1 flex items-center justify-between text-emerald-700">
                  <span className="text-sm font-semibold">
                    Discount{discountType === "PERCENT" ? ` (${discountNum}%)` : ""}
                  </span>
                  <span className="text-sm font-bold">−{formatPrice(discountAmt)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-1.5">
                  <span className="text-sm font-semibold text-slate-600">Amount due</span>
                  <span className="text-2xl font-black text-slate-900">
                    {formatPrice(net)}
                  </span>
                </div>
              </>
            )}
            <ChargeBreakdown total={net} settings={settingsQuery.data} />
          </div>

          {/* Bill-level discount — PIN-gated unless the store turns it off */}
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-700">Discount</p>
              {discountPinRequired && !unlocked && !pwOpen && (
                <button
                  type="button"
                  onClick={() => setPwOpen(true)}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-accent-700 hover:text-accent-800"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Add discount
                </button>
              )}
            </div>

            {discountPinRequired && pwOpen && !unlocked && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-800">
                  Enter the override PIN to apply a discount
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    value={pwValue}
                    autoFocus
                    onChange={(e) =>
                      setPwValue(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    onKeyDown={(e) => e.key === "Enter" && unlock()}
                    placeholder="Override PIN"
                    className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
                  />
                  <Button size="sm" onClick={unlock} disabled={pwBusy || !pwValue}>
                    {pwBusy ? "Checking…" : "Unlock"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setPwOpen(false);
                      setPwValue("");
                      setPwError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                {pwError && (
                  <p className="mt-1 text-xs font-semibold text-red-600">{pwError}</p>
                )}
              </div>
            )}

            {discountReady && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
                  {(
                    [
                      ["", "None"],
                      ["PERCENT", "% off"],
                      ["FIXED", "$ off"],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val || "none"}
                      type="button"
                      onClick={() => {
                        if (val !== discountType) setDiscountValue("");
                        setDiscountType(val);
                      }}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                        discountType === val
                          ? "bg-accent-600 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {discountType !== "" && (
                  <div className="flex items-center gap-1">
                    {discountType === "FIXED" && (
                      <span className="text-sm font-medium text-slate-500">$</span>
                    )}
                    <input
                      type="number"
                      min="0"
                      step={discountType === "PERCENT" ? "1" : "0.10"}
                      max={discountType === "PERCENT" ? "100" : undefined}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder={discountType === "PERCENT" ? "10" : "5.00"}
                      className="h-10 w-24 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-base font-bold text-slate-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
                    />
                    {discountType === "PERCENT" && (
                      <span className="text-sm font-medium text-slate-500">%</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Voucher */}
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Voucher (optional)</p>
            {attachedVoucher && voucherInput.trim() === "" && (
              <p className="mb-2 rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700">
                Customer applied{" "}
                <span className="font-mono font-bold">{attachedVoucher}</span> — it&apos;ll be
                applied at payment.
              </p>
            )}
            <Input
              value={voucherInput}
              onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
              placeholder={attachedVoucher ? "Override voucher code" : "Enter a voucher code"}
              className="font-mono uppercase tracking-wide"
            />
            <p className="mt-1 text-xs text-slate-400">
              Validated and applied by the server at settlement.
            </p>
          </div>

          {/* Payment method */}
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Payment method</p>
            {paymentMethods.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-400">
                No payment methods configured — add some in Settings.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {paymentMethods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-sm font-semibold transition-colors",
                      method === m
                        ? "border-accent-500 bg-accent-50 text-accent-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={closePayDialog} disabled={close.isPending}>
              Cancel
            </Button>
            <Button onClick={pay} disabled={!method || close.isPending}>
              {close.isPending
                ? "Settling…"
                : `Mark as paid${method ? ` · ${method}` : ""}`}
            </Button>
          </div>
        </div>
      </ModalDialog>

      <ConfirmDialog
        open={confirmCancel}
        title={`Cancel session #${sessionNumber}?`}
        message="This voids the whole tab and frees the table. All rounds are cancelled. This cannot be undone."
        confirmLabel="Cancel session"
        cancelLabel="Keep open"
        destructive
        busy={cancel.isPending}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() =>
          cancel.mutate(sessionId, {
            onSuccess: () => {
              clearDraft(sessionId);
              setConfirmCancel(false);
            },
          })
        }
      />
    </>
  );
}
