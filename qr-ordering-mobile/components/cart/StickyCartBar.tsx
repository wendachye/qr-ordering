"use client";

import Link from "next/link";
import { formatPrice } from "@/lib/currency";

/**
 * Sticky bottom bar shown on the menu page. Links to the cart page and shows
 * the live item count + subtotal. Hidden when the cart is empty.
 */
export function StickyCartBar({
  tableCode,
  itemCount,
  subtotal,
}: {
  tableCode: string;
  itemCount: number;
  subtotal: number;
}) {
  if (itemCount <= 0) return null;

  return (
    <div className="p-3">
      <Link
        href={`/order/${encodeURIComponent(tableCode)}/cart`}
        className="flex h-14 w-full items-center justify-between rounded-2xl bg-accent px-5 text-accent-fg shadow-lg transition-colors hover:bg-accent-dark active:bg-accent-dark"
      >
        <span className="flex items-center gap-2 font-semibold">
          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/25 px-2 text-sm">
            {itemCount}
          </span>
          View cart
        </span>
        <span className="font-bold">{formatPrice(subtotal)}</span>
      </Link>
    </div>
  );
}
