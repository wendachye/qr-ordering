"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, createOrder, getMenu, newIdempotencyKey } from "@/lib/api";
import type { MenuResponse } from "@/lib/types";
import {
  useCartStore,
  selectSubtotal,
  selectTotalItems,
} from "@/store/cart";
import { MobileShell } from "@/components/layout/MobileShell";
import { CartItemRow } from "@/components/cart/CartItemRow";
import { CartSummary } from "@/components/cart/CartSummary";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";

export function CartView({ tableCode }: { tableCode: string }) {
  const router = useRouter();

  const items = useCartStore((s) => s.items);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const setItemNote = useCartStore((s) => s.setItemNote);
  const clear = useCartStore((s) => s.clear);
  const setTable = useCartStore((s) => s.setTable);
  const repriceLines = useCartStore((s) => s.repriceLines);
  const totalItems = useCartStore(selectTotalItems);
  const subtotal = useCartStore(selectSubtotal);

  const [orderNote, setOrderNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Stable across retries of one submission so a network retry can't create a
  // duplicate order; regenerated only after a successful submit. Mirrored to
  // sessionStorage so a reload mid-submit reuses the same key (no duplicate).
  const idemKeyRef = useRef<string | null>(null);
  const idemStorageKey = `qr-idem:${tableCode}`;

  // The live menu, used to flag cart lines that have gone unorderable (sold
  // out / removed / made POS-only) while sitting in the persisted cart.
  const [menu, setMenu] = useState<MenuResponse | null>(null);

  // Avoid hydration mismatch: the cart is read from localStorage on the
  // client only. Render the empty/loaded UI after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setTable(tableCode);
    try {
      idemKeyRef.current = sessionStorage.getItem(idemStorageKey);
    } catch {
      // sessionStorage unavailable (private mode / old webview) — skip.
    }
    setMounted(true);
    // Reconcile the cart against the current menu; ignore failures (the server
    // still validates every line on submit).
    getMenu(tableCode)
      .then(setMenu)
      .catch(() => {});
  }, [tableCode, setTable, idemStorageKey]);

  const backHref = `/order/${encodeURIComponent(tableCode)}`;

  // Lines whose item/combo is no longer orderable once the live menu is known.
  const staleLineIds = useMemo(() => {
    const ids = new Set<string>();
    if (!menu) return ids;
    const orderableItems = new Set(
      menu.categories.flatMap((c) => c.items.map((i) => i.id))
    );
    const orderableCombos = new Set(
      (menu.combos ?? [])
        .filter((c) => c.isAvailable && !c.posOnly)
        .map((c) => c.id)
    );
    for (const line of items) {
      const ok =
        line.kind === "item"
          ? orderableItems.has(line.menuItemId)
          : orderableCombos.has(line.comboId);
      if (!ok) ids.add(line.lineId);
    }
    return ids;
  }, [menu, items]);
  const hasStale = staleLineIds.size > 0;

  // Re-derive each line's unit price against the live menu so a line that has sat
  // in the cart across a price change shows the CURRENT price. The server
  // re-prices on submit regardless — this just keeps the displayed total honest.
  useEffect(() => {
    if (!menu) return;
    const itemById = new Map(
      menu.categories.flatMap((c) => c.items).map((i) => [i.id, i] as const)
    );
    const comboById = new Map((menu.combos ?? []).map((c) => [c.id, c] as const));
    const prices: Record<string, number> = {};
    for (const line of items) {
      let derived: number | null = null;
      if (line.kind === "item") {
        const mi = itemById.get(line.menuItemId);
        if (mi) {
          let sum = mi.salePrice ?? mi.price;
          const chosen = new Set(line.optionChoiceIds);
          for (const g of mi.optionGroups)
            for (const c of g.choices) if (chosen.has(c.id)) sum += c.priceDelta;
          derived = sum;
        }
      } else {
        const combo = comboById.get(line.comboId);
        if (combo) {
          let sum = combo.price;
          for (const p of line.picks) {
            const opt = combo.groups
              .find((g) => g.id === p.groupId)
              ?.options.find((o) => o.id === p.optionId);
            if (opt) sum += opt.priceDelta;
          }
          derived = sum;
        }
      }
      if (derived != null && derived !== line.price) prices[line.lineId] = derived;
    }
    if (Object.keys(prices).length > 0) repriceLines(prices);
    // Re-derive once when the menu arrives; depending on `items` would loop since
    // repricing mutates `items`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, repriceLines]);

  const handleSubmit = async () => {
    if (submitting || items.length === 0 || hasStale) return;
    setSubmitting(true);
    setError(null);
    if (!idemKeyRef.current) {
      idemKeyRef.current = newIdempotencyKey();
      try {
        sessionStorage.setItem(idemStorageKey, idemKeyRef.current);
      } catch {
        // best-effort; submission still works without the persisted key
      }
    }
    try {
      const order = await createOrder(
        {
          tableCode,
          note: orderNote.trim() ? orderNote.trim() : undefined,
          items: items.map((i) => {
            const note = i.note?.trim() ? i.note.trim() : undefined;
            if (i.kind === "combo") {
              return {
                comboId: i.comboId,
                comboSelections: i.picks.map((p) => ({
                  groupId: p.groupId,
                  optionId: p.optionId,
                })),
                quantity: i.quantity,
                note,
              };
            }
            return {
              menuItemId: i.menuItemId,
              quantity: i.quantity,
              note,
              optionChoiceIds: i.optionChoiceIds,
            };
          }),
        },
        idemKeyRef.current
      );
      // Success: clear the cart and go to the success page. Pass the human
      // order number through as a query param for a nicer message.
      idemKeyRef.current = null;
      try {
        sessionStorage.removeItem(idemStorageKey);
      } catch {
        // best-effort
      }
      clear();
      router.replace(
        `/order/${encodeURIComponent(tableCode)}/success/${encodeURIComponent(
          order.id
        )}?n=${order.orderNumber}`
      );
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Couldn't submit your order. Please try again.";
      setError(message);
      setSubmitting(false);
    }
  };

  const header = (
    <div className="flex items-center gap-2 px-2 py-3">
      <Link
        href={backHref}
        aria-label="Back to menu"
        className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-black hover:bg-gray-100"
      >
        ‹
      </Link>
      <h1 className="text-lg font-bold text-black">Your order</h1>
    </div>
  );

  // Before mount we don't know the cart contents; show a minimal shell.
  if (!mounted) {
    return <MobileShell header={header}>{null}</MobileShell>;
  }

  if (items.length === 0) {
    return (
      <MobileShell header={header}>
        <EmptyState
          icon="🛒"
          title="Your cart is empty"
          message="Add some items from the menu to get started."
          actionHref={backHref}
          actionLabel="Browse menu"
        />
      </MobileShell>
    );
  }

  return (
    <MobileShell
      header={header}
      footer={
        <div className="p-3">
          {error && (
            <p
              role="alert"
              className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {hasStale && (
            <p
              role="alert"
              className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800"
            >
              Some items are no longer available. Remove the highlighted lines to
              continue.
            </p>
          )}
          <Button
            size="lg"
            className="w-full"
            disabled={submitting || hasStale}
            onClick={handleSubmit}
          >
            {submitting
              ? "Submitting..."
              : `Submit order · ${totalItems} item${
                  totalItems === 1 ? "" : "s"
                }`}
          </Button>
        </div>
      }
    >
      <div className="divide-y divide-gray-100">
        {items.map((item) => (
          <CartItemRow
            key={item.lineId}
            item={item}
            stale={staleLineIds.has(item.lineId)}
            onSetQuantity={setQuantity}
            onRemove={removeItem}
            onSetNote={setItemNote}
          />
        ))}
      </div>

      <CartSummary
        subtotal={subtotal}
        note={orderNote}
        onNoteChange={setOrderNote}
      />
    </MobileShell>
  );
}
