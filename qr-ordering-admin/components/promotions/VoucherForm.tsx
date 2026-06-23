"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Voucher, VoucherInput, DiscountType } from "@/lib/types";

function ymd(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

// Create / edit a discount voucher. Pure form: the host page owns persistence.
export function VoucherForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: Voucher;
  submitting: boolean;
  onSubmit: (input: VoucherInput) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [discountType, setDiscountType] = useState<DiscountType>(initial?.discountType ?? "PERCENT");
  const [discountValue, setDiscountValue] = useState(initial ? String(initial.discountValue) : "");
  const [minSpend, setMinSpend] = useState(initial?.minSpend ? String(initial.minSpend) : "");
  const [maxRedemptions, setMaxRedemptions] = useState(
    initial?.maxRedemptions != null ? String(initial.maxRedemptions) : ""
  );
  const [expiresAt, setExpiresAt] = useState(ymd(initial?.expiresAt ?? null));

  const dv = Number(discountValue);
  const codeOk = code.trim().length >= 2;
  const valueOk = dv > 0 && (discountType !== "PERCENT" || dv <= 100);
  const valid = codeOk && valueOk;

  const submit = () => {
    if (!valid) return;
    onSubmit({
      code: code.trim(),
      description: description.trim() || null,
      discountType,
      discountValue: dv,
      minSpend: minSpend ? Number(minSpend) : 0,
      maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
      // Expire at the end of the chosen day, or never.
      expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="v-code">Code</Label>
        <Input
          id="v-code"
          value={code}
          maxLength={40}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. WELCOME10"
          className="font-mono uppercase tracking-wide"
          autoFocus
        />
      </div>

      <div>
        <Label>Discount</Label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
            {(
              [
                ["PERCENT", "% off"],
                ["FIXED", "$ off"],
              ] as const
            ).map(([val, label]) => (
              <Button
                key={val}
                variant={discountType === val ? "default" : "outline"}
                onClick={() => setDiscountType(val)}
                className={cn(
                  "h-auto rounded-md border-0 bg-transparent px-3 py-1.5 text-sm font-semibold shadow-none transition-colors",
                  discountType === val ? "bg-accent-600 text-white" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {discountType === "FIXED" && <span className="text-sm font-medium text-slate-500">RM</span>}
            <Input
              type="number"
              min="0"
              step={discountType === "PERCENT" ? "1" : "0.10"}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === "PERCENT" ? "10" : "5.00"}
              className="w-24"
            />
            {discountType === "PERCENT" && <span className="text-sm font-medium text-slate-500">%</span>}
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="v-desc">Description (optional)</Label>
        <Input
          id="v-desc"
          value={description}
          maxLength={120}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. New customer welcome offer"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="v-min">Min spend (RM)</Label>
          <Input
            id="v-min"
            type="number"
            min="0"
            step="0.10"
            value={minSpend}
            onChange={(e) => setMinSpend(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <Label htmlFor="v-max">Usage limit</Label>
          <Input
            id="v-max"
            type="number"
            min="1"
            step="1"
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            placeholder="∞"
          />
        </div>
        <div>
          <Label htmlFor="v-exp">Expires</Label>
          <Input
            id="v-exp"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!valid || submitting}>
          {submitting ? "Saving…" : initial ? "Save changes" : "Create voucher"}
        </Button>
      </div>
    </div>
  );
}
