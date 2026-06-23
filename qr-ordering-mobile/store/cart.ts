"use client";

// Zustand cart store with per-table persistence in localStorage.
//
// One store under a single localStorage key ("qr-cart:store"), but each table
// keeps its OWN cart: `carts` maps tableCode -> lines, and `items` mirrors the
// active table's lines (what every selector/consumer reads). setTable snapshots
// the table you're leaving into `carts` and loads the one you're entering, so
// scanning a different table never wipes the first table's cart.
//
// Each cart line carries a stable `lineId`. ALL mutating operations key by
// `lineId` so two lines of the same item (different notes/options) stay
// independent. Adding tries to merge into an existing line first (same item +
// same option choices + same note + same unit price).

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem } from "@/lib/types";
import { safeUuid } from "@/lib/id";

// `Omit` over a discriminated union must DISTRIBUTE, or it collapses to the
// members' common keys (dropping menuItemId / comboId / picks). This keeps each
// variant's own fields on the add-item input.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type NewCartItem = DistributiveOmit<CartItem, "lineId">;

export type CartState = {
  tableCode: string | null;
  items: CartItem[];
  // Per-table carts (tableCode -> lines); `items` mirrors carts[tableCode].
  carts: Record<string, CartItem[]>;
  // actions
  setTable: (tableCode: string) => void;
  addItem: (item: NewCartItem) => void;
  removeItem: (lineId: string) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  increment: (lineId: string) => void;
  decrement: (lineId: string) => void;
  setItemNote: (lineId: string, note: string) => void;
  // Update unit prices for the given lineIds (re-derived against the live menu).
  repriceLines: (prices: Record<string, number>) => void;
  clear: () => void;
};

const STORAGE_PREFIX = "qr-cart";

// Two lines are mergeable when they share the same item, the same set of
// option choice ids (order-independent), and the same note.
function sameChoiceSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}

// Two cart lines are mergeable when they are the same kind, same note, and the
// same underlying selection: for items, the same item + option choice set; for
// combos, the same combo + the same chosen option id per group.
function isMergeable(a: CartItem, b: CartItem): boolean {
  if (a.kind !== b.kind) return false;
  if ((a.note ?? "") !== (b.note ?? "")) return false;
  // Never merge two lines priced differently (e.g. a sale started/ended between
  // adds) — the cart total would otherwise show the wrong unit price for both.
  if (a.price !== b.price) return false;
  if (a.kind === "item" && b.kind === "item") {
    return (
      a.menuItemId === b.menuItemId &&
      sameChoiceSet(a.optionChoiceIds, b.optionChoiceIds)
    );
  }
  if (a.kind === "combo" && b.kind === "combo") {
    if (a.comboId !== b.comboId) return false;
    // Compare the full (group → option) mapping, not just the set of option ids,
    // so two distinct configurations can never collapse into one line.
    return sameChoiceSet(
      a.picks.map((p) => `${p.groupId}:${p.optionId}`),
      b.picks.map((p) => `${p.groupId}:${p.optionId}`)
    );
  }
  return false;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      tableCode: null,
      items: [],
      carts: {},

      setTable: (tableCode) => {
        const { tableCode: current, items, carts } = get();
        if (current === tableCode) return;
        // Snapshot the table we're leaving, then load the one we're entering —
        // each table keeps its own cart instead of clobbering the other.
        const nextCarts = { ...carts };
        if (current) nextCarts[current] = items;
        set({ tableCode, carts: nextCarts, items: nextCarts[tableCode] ?? [] });
      },

      addItem: (item) => {
        const items = get().items;
        // Treat the incoming line as a full CartItem (lineId is filled below)
        // for the merge comparison.
        const candidate = { ...item, lineId: "" } as CartItem;
        const existing = items.find((i) => isMergeable(i, candidate));
        if (existing) {
          set({
            items: items.map((i) =>
              i === existing
                ? { ...i, quantity: Math.min(99, i.quantity + item.quantity) }
                : i
            ),
          });
        } else {
          set({
            items: [
              ...items,
              {
                ...item,
                lineId: safeUuid(),
                quantity: Math.min(99, item.quantity),
              } as CartItem,
            ],
          });
        }
      },

      removeItem: (lineId) =>
        set({ items: get().items.filter((i) => i.lineId !== lineId) }),

      setQuantity: (lineId, quantity) => {
        const q = Math.max(1, Math.min(99, Math.floor(quantity)));
        set({
          items: get().items.map((i) =>
            i.lineId === lineId ? { ...i, quantity: q } : i
          ),
        });
      },

      increment: (lineId) =>
        set({
          items: get().items.map((i) =>
            i.lineId === lineId
              ? { ...i, quantity: Math.min(99, i.quantity + 1) }
              : i
          ),
        }),

      decrement: (lineId) => {
        const items = get().items;
        const target = items.find((i) => i.lineId === lineId);
        if (!target) return;
        if (target.quantity <= 1) {
          // Drop the item when decremented below 1.
          set({ items: items.filter((i) => i.lineId !== lineId) });
        } else {
          set({
            items: items.map((i) =>
              i.lineId === lineId ? { ...i, quantity: i.quantity - 1 } : i
            ),
          });
        }
      },

      setItemNote: (lineId, note) =>
        set({
          items: get().items.map((i) =>
            i.lineId === lineId
              ? { ...i, note: note.trim() ? note : undefined }
              : i
          ),
        }),

      repriceLines: (prices) => {
        let changed = false;
        const next = get().items.map((i) => {
          const p = prices[i.lineId];
          if (p != null && p !== i.price) {
            changed = true;
            return { ...i, price: p };
          }
          return i;
        });
        if (changed) set({ items: next });
      },

      clear: () => {
        // Empty the active table's cart (and its snapshot), leaving other
        // tables' carts intact.
        const { tableCode, carts } = get();
        const nextCarts = { ...carts };
        if (tableCode) delete nextCarts[tableCode];
        set({ items: [], carts: nextCarts });
      },
    }),
    {
      name: `${STORAGE_PREFIX}:store`,
      storage: createJSONStorage(() => localStorage),
      // Persist the active table, its items, and every table's saved cart so a
      // reload — or a hop back to another table — keeps each cart.
      partialize: (state) => ({
        tableCode: state.tableCode,
        items: state.items,
        carts: state.carts,
      }),
    }
  )
);

// Derived selectors (use outside the store to avoid re-renders on every field).
export const selectTotalItems = (s: CartState) =>
  s.items.reduce((sum, i) => sum + i.quantity, 0);

export const selectSubtotal = (s: CartState) =>
  s.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
