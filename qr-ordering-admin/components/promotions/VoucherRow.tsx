"use client";

import { Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatPrice } from "@/lib/format";
import type { Voucher } from "@/lib/types";

function valueLabel(v: Voucher): string {
  return v.discountType === "PERCENT"
    ? `${v.discountValue}% off`
    : `${formatPrice(v.discountValue)} off`;
}
function ymd(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

// One voucher in the Promotions list: code + value + status badges, an active
// toggle, and edit / delete actions. The host page owns the mutations.
export function VoucherRow({
  voucher: v,
  toggling,
  onToggle,
  onEdit,
  onDelete,
}: {
  voucher: Voucher;
  toggling: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const expired = v.expiresAt != null && new Date(v.expiresAt).getTime() < Date.now();
  const usedUp = v.maxRedemptions != null && v.redeemedCount >= v.maxRedemptions;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
        <Ticket className="h-5 w-5" />
      </span>
      <div className="min-w-[8rem] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-base font-bold tracking-wide text-slate-900">
            {v.code}
          </span>
          <Badge tone="green">{valueLabel(v)}</Badge>
          {!v.isActive && <Badge tone="gray">Inactive</Badge>}
          {v.isActive && expired && <Badge tone="amber">Expired</Badge>}
          {v.isActive && !expired && usedUp && <Badge tone="amber">Used up</Badge>}
        </div>
        <p className="mt-0.5 text-sm text-slate-500">
          {v.description ? `${v.description} · ` : ""}
          {v.minSpend > 0 ? `Min ${formatPrice(v.minSpend)} · ` : ""}
          {v.maxRedemptions != null
            ? `${v.redeemedCount}/${v.maxRedemptions} used`
            : `${v.redeemedCount} used`}
          {v.expiresAt ? ` · expires ${ymd(v.expiresAt)}` : ""}
        </p>
      </div>
      <Switch
        checked={v.isActive}
        onCheckedChange={onToggle}
        disabled={toggling}
        aria-label={`Toggle ${v.code}`}
        className="shrink-0"
      />
      <Button variant="secondary" size="sm" onClick={onEdit}>
        Edit
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-red-600 hover:bg-red-50"
        onClick={onDelete}
      >
        Delete
      </Button>
    </div>
  );
}
