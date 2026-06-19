"use client";

import { useState } from "react";
import type { CartItem } from "@/lib/types";
import { formatPrice } from "@/lib/currency";
import { QuantityStepper } from "@/components/common/QuantityStepper";

export function CartItemRow({
  item,
  onSetQuantity,
  onRemove,
  onSetNote,
}: {
  item: CartItem;
  onSetQuantity: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  onSetNote: (lineId: string, note: string) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(Boolean(item.note));

  return (
    <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-black">{item.name}</h3>
          {item.options.length > 0 && (
            <ul className="mt-0.5 space-y-0.5">
              {item.options.map((o, i) => (
                <li key={i} className="text-xs text-gray-500">
                  {o.group}: {o.choice}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-0.5 text-sm text-gray-500">
            {formatPrice(item.price)} each
          </p>
        </div>
        <p className="shrink-0 font-semibold text-black">
          {formatPrice(item.price * item.quantity)}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <QuantityStepper
          value={item.quantity}
          onChange={(q) => onSetQuantity(item.lineId, q)}
        />
        <button
          type="button"
          onClick={() => onRemove(item.lineId)}
          className="text-sm font-medium text-red-600 hover:underline"
        >
          Remove
        </button>
      </div>

      {noteOpen ? (
        <input
          type="text"
          value={item.note ?? ""}
          maxLength={200}
          autoFocus={!item.note}
          onChange={(e) => onSetNote(item.lineId, e.target.value)}
          placeholder="Item note (e.g. no cucumber)"
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      ) : (
        <button
          type="button"
          onClick={() => setNoteOpen(true)}
          className="self-start text-sm font-medium text-accent hover:underline"
        >
          + Add note
        </button>
      )}
    </div>
  );
}
