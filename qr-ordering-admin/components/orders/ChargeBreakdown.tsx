"use client";

import { formatPrice } from "@/lib/format";
import { chargesFromSettings } from "@/lib/charges";
import { cn } from "@/lib/utils";
import type { Settings } from "@/lib/types";

/**
 * Itemises a tax-INCLUSIVE amount into Subtotal → Service charge → each tax, so
 * the bill / payment shows the breakdown even though the total already includes
 * them. Renders nothing when no service charge / tax is configured.
 */
export function ChargeBreakdown({
  total,
  settings,
  className,
}: {
  total: number;
  settings?: Pick<Settings, "serviceChargeRate" | "taxes"> | null;
  className?: string;
}) {
  const ch = chargesFromSettings(total, settings);
  if (!ch.hasCharges) return null;
  return (
    <div
      className={cn(
        "mt-2 space-y-0.5 border-t border-dashed border-slate-200 pt-2 text-xs text-slate-500",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span>Subtotal (ex. charges)</span>
        <span className="tabular-nums">{formatPrice(ch.subtotal)}</span>
      </div>
      {ch.serviceChargeRate > 0 && (
        <div className="flex items-center justify-between">
          <span>Service charge ({ch.serviceChargeRate}%)</span>
          <span className="tabular-nums">{formatPrice(ch.serviceCharge)}</span>
        </div>
      )}
      {ch.taxes.map((t) => (
        <div key={t.name} className="flex items-center justify-between">
          <span>
            {t.name} ({t.rate}%)
          </span>
          <span className="tabular-nums">{formatPrice(t.amount)}</span>
        </div>
      ))}
      <p className="pt-0.5 text-[11px] italic text-slate-400">
        Prices already include service charge &amp; tax.
      </p>
    </div>
  );
}
