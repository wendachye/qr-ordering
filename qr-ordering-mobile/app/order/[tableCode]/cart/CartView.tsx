"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, createOrder, newIdempotencyKey } from "@/lib/api";
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
  const totalItems = useCartStore(selectTotalItems);
  const subtotal = useCartStore(selectSubtotal);

  const [orderNote, setOrderNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Stable across retries of one submission so a network retry can't create a
  // duplicate order; regenerated only after a successful submit.
  const idemKeyRef = useRef<string | null>(null);

  // Avoid hydration mismatch: the cart is read from localStorage on the
  // client only. Render the empty/loaded UI after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setTable(tableCode);
    setMounted(true);
  }, [tableCode, setTable]);

  const backHref = `/order/${encodeURIComponent(tableCode)}`;

  const handleSubmit = async () => {
    if (submitting || items.length === 0) return;
    setSubmitting(true);
    setError(null);
    if (!idemKeyRef.current) idemKeyRef.current = newIdempotencyKey();
    try {
      const order = await createOrder(
        {
          tableCode,
          note: orderNote.trim() ? orderNote.trim() : undefined,
          items: items.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            note: i.note?.trim() ? i.note.trim() : undefined,
            optionChoiceIds: i.optionChoiceIds,
          })),
        },
        idemKeyRef.current
      );
      // Success: clear the cart and go to the success page. Pass the human
      // order number through as a query param for a nicer message.
      idemKeyRef.current = null;
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
            <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <Button
            size="lg"
            className="w-full"
            disabled={submitting}
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
