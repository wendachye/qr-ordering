"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CartLineList } from "./CartLineList";
import { formatPrice } from "@/lib/format";
import { cartItemCount, cartTotal, type CartLine } from "@/lib/pos";

// Right-hand cart panel for the POS screen: lists lines with qty steppers + note,
// a running total, an order note, and the Place order button.
export function CartPanel({
  lines,
  note,
  onNoteChange,
  onQtyChange,
  onRemove,
  onEdit,
  onSubmit,
  submitting,
  title = "Order",
  submitLabel = "Place order",
  hint,
  onClear,
}: {
  lines: CartLine[];
  note: string;
  onNoteChange: (v: string) => void;
  onQtyChange: (lineId: string, qty: number) => void;
  onRemove: (lineId: string) => void;
  // When provided, each line gets an Edit action that reopens the option picker.
  onEdit?: (line: CartLine) => void;
  onSubmit: () => void;
  submitting: boolean;
  title?: string;
  submitLabel?: string;
  hint?: ReactNode;
  // When provided, shows a "Clear all" action in the header (the parent owns the
  // confirmation + the actual clear).
  onClear?: () => void;
}) {
  const total = cartTotal(lines);
  const count = cartItemCount(lines);
  const empty = lines.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-500">
            {count} {count === 1 ? "item" : "items"}
          </span>
          {onClear && !empty && (
            <button
              type="button"
              onClick={onClear}
              className="text-sm font-semibold text-red-600 hover:text-red-700"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {empty ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center text-slate-400">
            <p className="text-base font-medium">No items yet</p>
            <p className="text-sm">Tap a menu item to add it to the order.</p>
          </div>
        ) : (
          <CartLineList
            lines={lines}
            onQtyChange={onQtyChange}
            onRemove={onRemove}
            onEdit={onEdit}
          />
        )}
      </div>

      <div className="border-t border-slate-200 px-5 py-4">
        <Label htmlFor="order-note">Order note (optional)</Label>
        <Textarea
          id="order-note"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="e.g. allergy info, serve together…"
          className="min-h-[60px]"
        />

        <div className="mt-4 flex items-center justify-between">
          <span className="text-base font-semibold text-slate-600">Total</span>
          <span className="text-2xl font-black text-slate-900">
            {formatPrice(total)}
          </span>
        </div>

        <Button
          size="lg"
          className="mt-4 w-full"
          disabled={empty || submitting}
          onClick={onSubmit}
        >
          {submitting ? "Sending…" : submitLabel}
        </Button>

        {hint && !empty && (
          <p className="mt-2 text-center text-xs text-slate-400">{hint}</p>
        )}
      </div>
    </div>
  );
}
