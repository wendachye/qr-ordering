"use client";

import { Ban, Printer, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice, formatTime } from "@/lib/format";
import type { SessionRound, SessionRoundItem } from "@/lib/types";

export function TabRound({
  round,
  onReprint,
  reprinting,
  onVoid,
}: {
  round: SessionRound;
  onReprint: () => void;
  reprinting: boolean;
  onVoid: (item: SessionRoundItem) => void;
}) {
  const cancelled = round.status === "CANCELLED";
  return (
    <li
      className={cn(
        "rounded-xl border border-slate-100 bg-slate-50/60 p-2.5",
        cancelled && "opacity-50"
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {round.roundNumber ? `Round ${round.roundNumber}` : "Round"} ·{" "}
          {formatTime(round.createdAt)}
        </span>
        <div className="flex items-center gap-2">
          {cancelled && <Badge tone="gray">Cancelled</Badge>}
          <Button
            variant="ghost"
            onClick={onReprint}
            disabled={reprinting}
            className="inline-flex h-auto items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-50"
          >
            <Printer className="h-3.5 w-3.5" />
            Reprint
          </Button>
        </div>
      </div>
      <ul className="space-y-1">
        {round.items.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-2 text-sm"
          >
            <div className="min-w-0">
              <span
                className={cn(
                  "text-slate-800",
                  item.voided && "text-slate-400 line-through"
                )}
              >
                <span className="font-semibold">{item.quantity}×</span> {item.name}
                {item.isTakeaway && (
                  <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-sky-100 px-1 py-0.5 text-[10px] font-bold uppercase text-sky-700">
                    <ShoppingBag className="h-2.5 w-2.5" />
                    TA
                  </span>
                )}
                {item.priceOverridden && (
                  <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                    $
                  </span>
                )}
                {item.discountAmount > 0 && (
                  <span className="ml-1 rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                    {item.discountType === "PERCENT"
                      ? `${item.discountValue}%`
                      : `−${formatPrice(item.discountAmount)}`}
                  </span>
                )}
                {item.selectedOptions.length > 0 && (
                  <span className="text-slate-400">
                    {" · "}
                    {item.selectedOptions.map((o) => o.choice).join(", ")}
                  </span>
                )}
              </span>
              {item.note && (
                <span className="block text-xs italic text-amber-700">
                  Remarks: {item.note}
                </span>
              )}
              {item.voided && (
                <span className="block text-xs font-semibold uppercase tracking-wide text-red-500">
                  Voided{item.voidReason ? ` · ${item.voidReason}` : ""}
                </span>
              )}
            </div>
            {item.voided ? (
              <span className="shrink-0 text-xs font-bold uppercase text-red-400">
                Void
              </span>
            ) : (
              <div className="flex shrink-0 items-center gap-1.5">
                {item.discountAmount > 0 && (
                  <span className="text-xs text-slate-400 line-through">
                    {formatPrice(item.totalPrice + item.discountAmount)}
                  </span>
                )}
                <span className="font-medium text-slate-600">
                  {formatPrice(item.totalPrice)}
                </span>
                {!cancelled && (
                  <Button
                    variant="ghost"
                    onClick={() => onVoid(item)}
                    aria-label={`Void ${item.name}`}
                    className="h-auto rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Ban className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </li>
  );
}
