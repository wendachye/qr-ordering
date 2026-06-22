"use client";

import { Pencil, ShoppingBag, Trash2 } from "lucide-react";
import { QtyStepper } from "./QtyStepper";
import { formatPrice } from "@/lib/format";
import { lineDiscountAmount, lineTotal, type CartLine } from "@/lib/pos";

// The editable list of cart lines (qty stepper + remove + line total). Shared by
// the POS CartPanel and the table workspace's "New items" section. When `onEdit`
// is passed, each line gets an Edit action that reopens the option picker.
export function CartLineList({
  lines,
  onQtyChange,
  onRemove,
  onEdit,
}: {
  lines: CartLine[];
  onQtyChange: (lineId: string, qty: number) => void;
  onRemove: (lineId: string) => void;
  onEdit?: (line: CartLine) => void;
}) {
  return (
    <ul className="space-y-2">
      {lines.map((line) => (
        <li
          key={line.lineId}
          className="rounded-xl border border-slate-200 bg-white p-2.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight text-slate-900">{line.name}</p>
              {line.options.length > 0 && (
                <p className="mt-0.5 text-sm text-slate-500">
                  {line.options.map((o) => o.choice).join(", ")}
                </p>
              )}
              {line.note && (
                <p className="mt-0.5 text-sm italic text-slate-400">
                  “{line.note}”
                </p>
              )}
              {(line.isTakeaway || line.priceOverridden || line.discountType) && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {line.isTakeaway && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">
                      <ShoppingBag className="h-3 w-3" />
                      Takeaway
                      {line.takeawayCharge
                        ? ` +${formatPrice(line.takeawayCharge)}`
                        : ""}
                    </span>
                  )}
                  {line.priceOverridden && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      Price override
                    </span>
                  )}
                  {line.discountType && lineDiscountAmount(line) > 0 && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      {line.discountType === "PERCENT"
                        ? `${line.discountValue}% off`
                        : `−${formatPrice(lineDiscountAmount(line))}`}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {onEdit && !line.custom && (
                <button
                  type="button"
                  onClick={() => onEdit(line)}
                  aria-label={`Edit ${line.name}`}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(line.lineId)}
                aria-label={`Remove ${line.name}`}
                className="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <QtyStepper
              value={line.quantity}
              onChange={(q) => onQtyChange(line.lineId, q)}
              size="sm"
            />
            <span className="flex items-baseline gap-1.5">
              {lineDiscountAmount(line) > 0 && (
                <span className="text-xs text-slate-400 line-through">
                  {formatPrice(lineTotal(line) + lineDiscountAmount(line))}
                </span>
              )}
              <span className="font-bold text-slate-900">
                {formatPrice(lineTotal(line))}
              </span>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
