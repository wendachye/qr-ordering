"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MultiCombobox } from "@/components/ui/multi-combobox";

// Quick-pick suggestions for the payment-methods combobox (staff can add custom).
export const PAYMENT_SUGGESTIONS = [
  "Cash",
  "Visa",
  "Mastercard",
  "American Express",
  "GrabPay",
  "Touch 'n Go",
  "Boost",
  "ShopeePay",
  "DuitNow QR",
  "Maybank QR",
  "Bank Transfer",
  "Alipay",
  "WeChat Pay",
  "Voucher",
];

// The tenant's accepted payment methods, shown in the Make-payment dialog.
export function PaymentMethodsCard({
  methods,
  onSave,
  saving,
}: {
  methods: string[];
  onSave: (m: string[]) => void;
  saving: boolean;
}) {
  const [list, setList] = useState<string[]>(methods);
  useEffect(() => {
    setList(methods);
  }, [methods]);

  const dirty = JSON.stringify(list) !== JSON.stringify(methods);
  const empty = list.length === 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
          <CreditCard className="h-5 w-5" />
        </span>
        <div>
          <p className="font-bold text-slate-900">Payment methods</p>
          <p className="text-sm text-slate-500">
            Shown in the Make-payment dialog when settling a tab.
          </p>
        </div>
      </div>

      <div className="mt-3">
        <MultiCombobox
          value={list}
          onChange={setList}
          suggestions={PAYMENT_SUGGESTIONS}
          max={20}
          maxLen={40}
          placeholder="Select or add a payment method…"
          createLabel={(qq) => `Add “${qq}”`}
        />
      </div>

      <div className="mt-3 flex items-center justify-end gap-3">
        {empty ? (
          <span className="text-sm font-medium text-red-600">Keep at least one method</span>
        ) : (
          dirty && <span className="text-sm font-medium text-amber-600">Unsaved changes</span>
        )}
        <Button size="sm" disabled={!dirty || empty || saving} onClick={() => onSave(list)}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
