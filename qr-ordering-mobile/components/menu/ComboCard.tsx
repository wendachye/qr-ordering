"use client";

import { memo } from "react";
import type { PublicCombo } from "@/lib/types";
import { formatPrice } from "@/lib/currency";
import { assetUrl } from "@/lib/assets";

/**
 * Grid card for a single combo / set meal (2-up grid). The whole card opens the
 * combo modal. Mirrors MenuItemCard; a "Set" badge marks it as a combo and the
 * price reads "from RM<base>" since premium picks can add to it.
 */
// Memoised (see MenuItemCard): re-renders only when its own props change.
export const ComboCard = memo(function ComboCard({
  combo,
  quantityInCart,
  onSelect,
}: {
  combo: PublicCombo;
  quantityInCart: number;
  onSelect: (combo: PublicCombo) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(combo)}
      className="group flex w-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-left transition hover:border-accent/40 hover:shadow-sm active:scale-[0.99]"
    >
      {/* Image (first photo) or initial-letter placeholder */}
      <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
        {combo.imageUrls.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={assetUrl(combo.imageUrls[0])}
            alt={combo.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="select-none text-4xl font-black text-gray-300">
            {combo.name.charAt(0).toUpperCase()}
          </span>
        )}

        {/* "Set" badge marks this as a combo (top-left). */}
        <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-fg shadow-sm">
          Set
        </span>

        {quantityInCart > 0 && (
          <span className="absolute bottom-2 right-2 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-accent-fg">
            {quantityInCart}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
          {combo.name}
        </h3>
        {combo.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{combo.description}</p>
        )}
        <p className="mt-2 text-sm font-bold text-gray-900">
          <span className="text-xs font-medium text-gray-400">from </span>
          {formatPrice(combo.price)}
        </p>
      </div>
    </button>
  );
});
