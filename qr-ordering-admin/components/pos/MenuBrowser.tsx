"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { assetUrl } from "@/lib/assets";
import { formatPrice } from "@/lib/format";
import type { PublicMenuCategory, PublicMenuItem } from "@/lib/types";

// Normalise for search: strip diacritics + lowercase so "creme" matches "crème".
// The class escapes combining diacritical marks (U+0300–U+036F) by codepoint so
// no literal combining characters live in the source.
const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
function norm(s: string): string {
  return s.normalize("NFD").replace(DIACRITICS, "").toLowerCase();
}

// Left-hand menu browser for the POS: a search box, category tabs and a
// responsive grid of item cards. While searching, the tabs are replaced by a
// flat grid of matches across every category (each card captioned with its
// category + a description preview). Matching is token-AND over name +
// description, so "salmon roll" matches "spicy roll with salmon". Sold-out items
// are shown but disabled. Tapping an available item opens the option picker
// (handled by the parent via onPick).
//
// State is per-instance: callers with an in-place menu switch (the free-table
// POS table dropdown) pass key={tableCode} so the query/active tab reset when
// the menu changes.
export function MenuBrowser({
  categories,
  onPick,
  onAddCustom,
}: {
  categories: PublicMenuCategory[];
  onPick: (item: PublicMenuItem) => void;
  // When provided, a "Custom" button sits beside the search box for adding an
  // off-menu (open) line — name + price typed by staff.
  onAddCustom?: () => void;
}) {
  const nonEmpty = useMemo(
    () => categories.filter((c) => c.items.length > 0),
    [categories]
  );
  const [activeId, setActiveId] = useState<string>(nonEmpty[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Pre-normalised search index (recomputed only when the menu changes).
  const index = useMemo(
    () =>
      nonEmpty.flatMap((c) =>
        c.items.map((item) => ({
          item,
          categoryName: c.name,
          hay: norm(`${item.name} ${item.description ?? ""}`),
        }))
      ),
    [nonEmpty]
  );
  const tokens = useMemo(
    () => norm(query).split(/\s+/).filter(Boolean),
    [query]
  );
  const searching = tokens.length > 0;
  const results = useMemo(
    () => (searching ? index.filter((e) => tokens.every((t) => e.hay.includes(t))) : []),
    [searching, index, tokens]
  );

  // Keep a valid active tab if the menu changes (e.g. switching tables).
  const active = nonEmpty.find((c) => c.id === activeId) ?? nonEmpty[0] ?? null;

  if (nonEmpty.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-slate-400">
        <p>No items on this menu.</p>
        {onAddCustom && (
          <button
            type="button"
            onClick={onAddCustom}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent-200 bg-white px-3 py-2 text-sm font-semibold text-accent-700 transition-colors hover:bg-accent-50"
          >
            <Plus className="h-4 w-4" />
            Custom item
          </button>
        )}
      </div>
    );
  }

  const shown: { item: PublicMenuItem; categoryName?: string }[] = searching
    ? results
    : (active?.items ?? []).map((item) => ({ item }));

  return (
    <div className="flex h-full flex-col">
      {/* Search + category tabs */}
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the menu…"
              aria-label="Search the menu"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
            />
            {searching && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {onAddCustom && (
            <button
              type="button"
              onClick={onAddCustom}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-accent-200 bg-white px-3 text-sm font-semibold text-accent-700 transition-colors hover:bg-accent-50"
            >
              <Plus className="h-4 w-4" />
              Custom
            </button>
          )}
        </div>

        {!searching && (
          <div className="mt-3 flex flex-wrap gap-2">
            {nonEmpty.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveId(cat.id)}
                className={cn(
                  "whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                  active?.id === cat.id
                    ? "bg-accent-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Item grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {searching && (
          <p
            role="status"
            aria-live="polite"
            className="mb-3 text-xs font-medium text-slate-400"
          >
            {shown.length} {shown.length === 1 ? "result" : "results"} for “
            {query.trim()}”
          </p>
        )}
        {shown.length === 0 ? (
          <div
            role="status"
            className="flex min-h-[160px] flex-col items-center justify-center gap-2 text-center text-slate-400"
          >
            <Search className="h-6 w-6" />
            <p>
              {searching
                ? `No items match “${query.trim()}”.`
                : "No items in this category."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {shown.map(({ item, categoryName }) => (
              <ItemCard
                key={item.id}
                item={item}
                categoryName={categoryName}
                onPick={onPick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemCard({
  item,
  categoryName,
  onPick,
}: {
  item: PublicMenuItem;
  categoryName?: string;
  onPick: (item: PublicMenuItem) => void;
}) {
  const soldOut = !item.isAvailable;
  const thumb = item.imageUrls?.[0];

  return (
    <button
      type="button"
      disabled={soldOut}
      onClick={() => onPick(item)}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition-shadow",
        soldOut
          ? "cursor-not-allowed opacity-60"
          : "hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
      )}
    >
      <div className="relative aspect-[4/3] w-full bg-slate-100">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={assetUrl(thumb)}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <svg
              className="h-8 w-8"
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
        )}
        {item.tag && !soldOut && (
          <span className="absolute left-2 top-2 rounded-full bg-accent-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
            {item.tag}
          </span>
        )}
        {soldOut && (
          <span className="absolute left-2 top-2 rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
            Sold out
          </span>
        )}
        {item.posOnly && (
          <span className="absolute right-2 top-2 rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
            Staff
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        {categoryName && (
          <p className="mb-0.5 truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {categoryName}
          </p>
        )}
        <p className="line-clamp-2 font-semibold leading-snug text-slate-900">
          {item.name}
        </p>
        {item.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {/* In search mode, show a description preview so description-only
            matches are self-explanatory. */}
        {categoryName && item.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">
            {item.description}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-bold text-slate-900">
            {formatPrice(item.price)}
          </span>
          {item.optionGroups.length > 0 && (
            <span className="text-xs font-medium text-slate-400">options</span>
          )}
        </div>
      </div>
    </button>
  );
}
