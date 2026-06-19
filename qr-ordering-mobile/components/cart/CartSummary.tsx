"use client";

import { formatPrice } from "@/lib/currency";

/**
 * Order-level note textarea + subtotal display, shown above the submit button
 * on the cart page.
 */
export function CartSummary({
  subtotal,
  note,
  onNoteChange,
}: {
  subtotal: number;
  note: string;
  onNoteChange: (note: string) => void;
}) {
  return (
    <div className="px-4 py-4">
      <label
        htmlFor="order-note"
        className="mb-1.5 block text-sm font-medium text-gray-700"
      >
        Order note (optional)
      </label>
      <textarea
        id="order-note"
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        rows={2}
        maxLength={300}
        placeholder="Anything the kitchen should know?"
        className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
        <span className="text-base font-medium text-gray-700">Subtotal</span>
        <span className="text-xl font-bold text-black">
          {formatPrice(subtotal)}
        </span>
      </div>
    </div>
  );
}
