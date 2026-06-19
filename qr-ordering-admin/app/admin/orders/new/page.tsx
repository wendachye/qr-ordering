"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { useToast } from "@/components/common/Toast";
import { MenuBrowser } from "@/components/pos/MenuBrowser";
import { OptionPicker } from "@/components/pos/OptionPicker";
import { CustomItemDialog } from "@/components/pos/CustomItemDialog";
import { CartPanel } from "@/components/pos/CartPanel";
import { ordersApi, tablesApi, publicApi, sessionsApi } from "@/lib/endpoints";
import { ApiError, newIdempotencyKey } from "@/lib/api";
import {
  cartItemCount,
  cartLinesFromSession,
  cartLineToPlaceOrderItem,
  type CartLine,
} from "@/lib/pos";
import type { PlaceOrderResponse, PublicMenuItem } from "@/lib/types";

export default function NewOrderPage() {
  const router = useRouter();
  const { toast } = useToast();
  const idemKeyRef = useRef<string | null>(null);

  // Active tables drive the table picker.
  const tablesQuery = useQuery({
    queryKey: ["tables"],
    queryFn: tablesApi.list,
  });
  const activeTables = useMemo(
    () => (tablesQuery.data ?? []).filter((t) => t.isActive),
    [tablesQuery.data]
  );

  const [tableCode, setTableCode] = useState<string>("");

  // Select the table from ?table=<code> (e.g. tapping a table on /admin/tables)
  // if it's active, otherwise fall back to the first active table. We read the
  // query param inside the effect so it's available before the first pick.
  useEffect(() => {
    if (activeTables.length === 0) return;
    if (activeTables.some((t) => t.code === tableCode)) return;
    const requested = new URLSearchParams(window.location.search).get("table");
    const preferred = requested
      ? activeTables.find((t) => t.code === requested)
      : undefined;
    setTableCode(preferred ? preferred.code : activeTables[0].code);
  }, [activeTables, tableCode]);

  const menuQuery = useQuery({
    queryKey: ["public-menu", tableCode],
    queryFn: () => publicApi.menu(tableCode),
    enabled: !!tableCode,
  });

  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderNote, setOrderNote] = useState("");
  const [picking, setPicking] = useState<PublicMenuItem | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  // A cart line being edited (reopens the picker seeded from that line).
  const [editingLine, setEditingLine] = useState<CartLine | null>(null);
  const menuItems = useMemo(
    () => menuQuery.data?.categories.flatMap((c) => c.items) ?? [],
    [menuQuery.data]
  );
  const editingItem = editingLine
    ? menuItems.find((m) => m.id === editingLine.menuItemId) ?? null
    : null;

  // "Order again": if ?from=<sessionId> is present, pre-fill the cart from that
  // past session once the menu loads. Staff review + place (so createOrder
  // validates); items no longer on the menu are skipped.
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (prefilledRef.current || !menuQuery.data) return;
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from");
    if (!from) return;
    const onlyOrder = params.get("order"); // repeat a single order, not the whole tab
    prefilledRef.current = true;
    sessionsApi
      .get(from)
      .then((session) => {
        const menuItems = menuQuery.data!.categories.flatMap((c) => c.items);
        const rounds = onlyOrder
          ? session.rounds.filter((r) => r.id === onlyOrder)
          : session.rounds;
        const { lines, skipped } = cartLinesFromSession(menuItems, rounds);
        if (lines.length) setCart(lines);
        toast(
          lines.length
            ? `Loaded ${cartItemCount(lines)} item(s) to repeat${
                skipped.length ? ` · ${skipped.length} no longer available` : ""
              } — review and place.`
            : "Those items are no longer available.",
          lines.length ? "success" : "error"
        );
      })
      .catch(() => toast("Couldn't load that past order.", "error"));
  }, [menuQuery.data, toast]);

  const placeOrder = useMutation({
    mutationFn: () => {
      if (!idemKeyRef.current) idemKeyRef.current = newIdempotencyKey();
      return ordersApi.create(
        {
          tableCode,
          note: orderNote.trim() ? orderNote.trim() : undefined,
          items: cart.map(cartLineToPlaceOrderItem),
        },
        idemKeyRef.current
      );
    },
    onSuccess: (res: PlaceOrderResponse) => {
      idemKeyRef.current = null;
      toast(`Order #${res.orderNumber} sent to kitchen`, "success");
      setCart([]);
      setOrderNote("");
      // Land on the table's running tab so staff sees the new round.
      router.push(`/admin/sessions/${res.sessionId}`);
    },
    onError: (err) =>
      toast(
        err instanceof ApiError ? err.message : "Could not place the order.",
        "error"
      ),
  });

  const addLine = (line: CartLine) => {
    setCart((prev) => [...prev, line]);
    setPicking(null);
  };
  const updateLine = (line: CartLine) => {
    setCart((prev) => prev.map((l) => (l.lineId === line.lineId ? line : l)));
    setEditingLine(null);
  };
  const changeQty = (lineId: string, qty: number) =>
    setCart((prev) =>
      prev.map((l) => (l.lineId === lineId ? { ...l, quantity: qty } : l))
    );
  const removeLine = (lineId: string) =>
    setCart((prev) => prev.filter((l) => l.lineId !== lineId));

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/admin/floor"
            className="inline-flex items-center gap-1 text-base font-semibold text-accent-700 hover:text-accent-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Floor
          </Link>
          <h1 className="text-3xl font-black text-slate-900">New order</h1>
        </div>

        <div className="flex items-center gap-3">
          <Label htmlFor="pos-table" className="mb-0 whitespace-nowrap">
            Table
          </Label>
          <Select
            value={tableCode || undefined}
            onValueChange={setTableCode}
            disabled={activeTables.length === 0}
          >
            <SelectTrigger id="pos-table" className="w-56">
              <SelectValue
                placeholder={
                  activeTables.length === 0
                    ? "No active tables"
                    : "Select a table"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {activeTables.map((t) => (
                <SelectItem key={t.id} value={t.code}>
                  {t.name} ({t.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {tablesQuery.isLoading ? (
        <LoadingState label="Loading tables…" />
      ) : tablesQuery.isError ? (
        <ErrorState
          message={
            tablesQuery.error instanceof ApiError
              ? tablesQuery.error.message
              : "Could not load tables."
          }
          onRetry={() => tablesQuery.refetch()}
        />
      ) : activeTables.length === 0 ? (
        <ErrorState
          message="There are no active tables. Activate a table first to place an order."
          onRetry={() => tablesQuery.refetch()}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_22rem] xl:grid-cols-[1fr_26rem]">
          {/* Menu (left) */}
          <div className="min-h-[60vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-[calc(100vh-12rem)]">
            {menuQuery.isLoading ? (
              <LoadingState label="Loading menu…" />
            ) : menuQuery.isError ? (
              <ErrorState
                message={
                  menuQuery.error instanceof ApiError
                    ? menuQuery.error.message
                    : "Could not load the menu."
                }
                onRetry={() => menuQuery.refetch()}
              />
            ) : (
              // key per table so search/active-tab state resets when the staff
              // switch tables via the dropdown (the menu changes in place).
              <MenuBrowser
                key={tableCode}
                categories={menuQuery.data?.categories ?? []}
                onPick={setPicking}
                onAddCustom={() => setCustomOpen(true)}
              />
            )}
          </div>

          {/* Cart (right) */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-24 lg:h-[calc(100vh-12rem)]">
            <CartPanel
              lines={cart}
              note={orderNote}
              onNoteChange={setOrderNote}
              onQtyChange={changeQty}
              onRemove={removeLine}
              onEdit={setEditingLine}
              onSubmit={() => placeOrder.mutate()}
              submitting={placeOrder.isPending}
            />
          </div>
        </div>
      )}

      {/* Option / quantity picker (also reopens to edit a placed cart line) */}
      <OptionPicker
        item={editingLine ? editingItem : picking}
        open={!!picking || !!editingLine}
        editing={editingLine}
        takeawayCharge={menuQuery.data?.takeawayCharge ?? 0}
        onClose={() => {
          setPicking(null);
          setEditingLine(null);
        }}
        onAdd={addLine}
        onSave={updateLine}
      />

      <CustomItemDialog
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onConfirm={addLine}
      />
    </AdminShell>
  );
}
