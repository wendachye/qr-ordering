"use client";

// Zustand cart store with per-table persistence in localStorage.
//
// The cart is keyed per table code via a dynamic storage key
// ("qr-cart:<TABLECODE>"). Switching tables uses a different key, so each
// table keeps its own cart. We expose a single store but rehydrate it against
// the active table on mount (see useCartForTable).
//
// Each cart line carries a stable `lineId`. ALL mutating operations key by
// `lineId` so two lines of the same item (different notes/options) stay
// independent. Adding tries to merge into an existing line first (same item +
// same option choices + same note).

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem } from "@/lib/types";

// `Omit` over a discriminated union must DISTRIBUTE, or it collapses to the
// members' common keys (dropping menuItemId / comboId / picks). This keeps each
// variant's own fields on the add-item input.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type NewCartItem = DistributiveOmit<CartItem, "lineId">;

export type CartState = {
  tableCode: string | null;
  items: CartItem[];
  // actions
  setTable: (tableCode: string) => void;
  addItem: (item: NewCartItem) => void;
  removeItem: (lineId: string) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  increment: (lineId: string) => void;
  decrement: (lineId: string) => void;
  setItemNote: (lineId: string, note: string) => void;
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

// We persist using a single key but namespace the data by tableCode inside
// partialize so different tables don't share carts. Simpler + robust across
// SSR: keep one store, store tableCode alongside items, and reset items when
// the table changes.

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      tableCode: null,
      items: [],

      setTable: (tableCode) => {
        const current = get().tableCode;
        if (current === tableCode) return;
        // New/different table: start a fresh cart for it.
        set({ tableCode, items: [] });
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
                lineId: crypto.randomUUID(),
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

      clear: () => set({ items: [] }),
    }),
    {
      name: `${STORAGE_PREFIX}:store`,
      storage: createJSONStorage(() => localStorage),
      // Persist both the active table and its items so a reload keeps the cart.
      partialize: (state) => ({
        tableCode: state.tableCode,
        items: state.items,
      }),
    }
  )
);

// Derived selectors (use outside the store to avoid re-renders on every field).
export const selectTotalItems = (s: CartState) =>
  s.items.reduce((sum, i) => sum + i.quantity, 0);

export const selectSubtotal = (s: CartState) =>
  s.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
