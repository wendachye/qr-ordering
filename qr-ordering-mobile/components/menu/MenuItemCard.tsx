"use client";

import type { MenuItem } from "@/lib/types";
import { formatPrice } from "@/lib/currency";
import { assetUrl } from "@/lib/assets";
import { tagBadgeClasses } from "@/lib/tags";

/**
 * Grid card for a single menu item (2-up grid). The whole card opens the item
 * modal; sold-out items are disabled. The item's attribute tags (Spicy,
 * Vegetarian, …) are shown as coloured badges over the top-left of the image.
 */
export function MenuItemCard({
  item,
  quantityInCart,
  onSelect,
}: {
  item: MenuItem;
  quantityInCart: number;
  onSelect: (item: MenuItem) => void;
}) {
  const soldOut = !item.isAvailable;

  return (
    <button
      type="button"
      disabled={soldOut}
      onClick={() => onSelect(item)}
      className={`group flex w-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-left transition ${
        soldOut
          ? "cursor-not-allowed opacity-70"
          : "hover:border-accent/40 hover:shadow-sm active:scale-[0.99]"
      }`}
    >
      {/* Image (first photo) or initial-letter placeholder */}
      <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
        {item.imageUrls.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={assetUrl(item.imageUrls[0])}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="select-none text-4xl font-black text-gray-300">
            {item.name.charAt(0).toUpperCase()}
          </span>
        )}

        {/* Attribute tags (Spicy, Vegetarian, …) over the top-left of the image.
            Cap at 2 to keep the card clean; the rest show as "+N" and the full
            list appears in the item detail. */}
        {item.tags.length > 0 && (
          <div className="absolute left-2 top-2 flex max-w-[calc(100%-1rem)] flex-wrap gap-1">
            {item.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm ${tagBadgeClasses(t)}`}
              >
                {t}
              </span>
            ))}
            {item.tags.length > 2 && (
              <span className="rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm backdrop-blur">
                +{item.tags.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Sale badge (top-right) when the item is discounted */}
        {item.salePrice != null && item.salePrice < item.price && (
          <span className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
            -{Math.round((1 - item.salePrice / item.price) * 100)}%
          </span>
        )}

        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50">
            <span className="rounded-full bg-gray-800/85 px-3 py-1 text-xs font-semibold text-white">
              Sold out
            </span>
          </div>
        )}
        {!soldOut && quantityInCart > 0 && (
          <span className="absolute bottom-2 right-2 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-accent-fg">
            {quantityInCart}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
          {item.name}
        </h3>
        {item.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{item.description}</p>
        )}
        {item.salePrice != null && item.salePrice < item.price ? (
          <p className="mt-2 flex items-baseline gap-1.5 text-sm font-bold">
            <span className="text-red-600">{formatPrice(item.salePrice)}</span>
            <span className="text-xs font-medium text-gray-400 line-through">
              {formatPrice(item.price)}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-sm font-bold text-gray-900">{formatPrice(item.price)}</p>
        )}
      </div>
    </button>
  );
}
