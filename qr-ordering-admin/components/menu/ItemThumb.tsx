import { assetUrl } from "@/lib/assets";
import type { MenuItem } from "@/lib/types";

// Small square thumbnail for a menu item (cover image or a placeholder).
export function ItemThumb({ item }: { item: MenuItem }) {
  const url = item.imageUrls?.[0];
  if (!url) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-300">
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={assetUrl(url)}
      alt={item.name}
      className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover"
    />
  );
}
