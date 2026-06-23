"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
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
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { MenuBrowser } from "@/components/pos/MenuBrowser";
import { OptionPicker } from "@/components/pos/OptionPicker";
import { ComboPicker } from "@/components/pos/ComboPicker";
import { CustomItemDialog } from "@/components/pos/CustomItemDialog";
import { CartPanel } from "@/components/pos/CartPanel";
import { ordersApi, tablesApi, posMenuApi, sessionsApi } from "@/lib/endpoints";
import { useDraftCart } from "@/hooks/useDraftCart";
import { ApiError, newIdempotencyKey } from "@/lib/api";
import {
  cartItemCount,
  cartLinesFromSession,
  cartLineToPlaceOrderItem,
  type CartLine,
} from "@/lib/pos";
import type { Combo, PlaceOrderResponse, PublicMenuItem } from "@/lib/types";

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

  // POS menu (includes POS-only "secret" items) for the selected table.
  const menuQuery = useQuery({
    queryKey: ["pos-menu", tableCode],
    queryFn: () => posMenuApi.get(tableCode),
    enabled: !!tableCode,
  });

  // The in-progress cart is a per-table draft (localStorage, keyed by table
  // code), so adding items then going back to the Floor keeps them safe and
  // unsent — they only reach the kitchen when "Place order" is pressed.
  const { cart, setCart, note: orderNote, setNote: setOrderNote, clearDraft } =
    useDraftCart(tableCode ? `table:${tableCode}` : "");
  const [picking, setPicking] = useState<PublicMenuItem | null>(null);
  // A combo being added (opens the combo picker).
  const [pickingCombo, setPickingCombo] = useState<Combo | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  // A cart line being edited (reopens the picker seeded from that line). Combo
  // lines route to a separate state so they reopen the combo picker.
  const [editingLine, setEditingLine] = useState<CartLine | null>(null);
  const [editingComboLine, setEditingComboLine] = useState<CartLine | null>(null);
  const menuItems = useMemo(
    () => menuQuery.data?.categories.flatMap((c) => c.items) ?? [],
    [menuQuery.data]
  );
  const combos = menuQuery.data?.combos ?? [];
  const editingItem = editingLine
    ? menuItems.find((m) => m.id === editingLine.menuItemId) ?? null
    : null;
  // The combo definition backing the combo line being edited (for the picker).
  const editingCombo = editingComboLine
    ? combos.find((c) => c.id === editingComboLine.comboId) ?? null
    : null;
  // Route an Edit click to the right picker by line kind.
  const editLine = (line: CartLine) => {
    if (line.combo) setEditingComboLine(line);
    else setEditingLine(line);
  };

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
      clearDraft();
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
  // Combo add / save — separate close handlers so the combo picker state clears.
  const addComboLine = (line: CartLine) => {
    setCart((prev) => [...prev, line]);
    setPickingCombo(null);
  };
  const updateComboLine = (line: CartLine) => {
    setCart((prev) => prev.map((l) => (l.lineId === line.lineId ? line : l)));
    setEditingComboLine(null);
  };
  const changeQty = (lineId: string, qty: number) =>
    setCart((prev) =>
      prev.map((l) => (l.lineId === lineId ? { ...l, quantity: qty } : l))
    );
  const removeLine = (lineId: string) =>
    setCart((prev) => prev.filter((l) => l.lineId !== lineId));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/admin/tables"
            className="inline-flex items-center gap-1 text-base font-semibold text-accent-700 hover:text-accent-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Tables
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_20rem] lg:grid-cols-[1fr_22rem] xl:grid-cols-[1fr_26rem]">
          {/* Menu (left) */}
          <div className="min-h-[60vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:h-[calc(100vh-12rem)]">
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
                combos={combos}
                onPick={setPicking}
                onPickCombo={setPickingCombo}
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
              onEdit={editLine}
              onSubmit={() => placeOrder.mutate()}
              submitting={placeOrder.isPending}
              onClear={() => setConfirmClear(true)}
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

      {/* Combo picker (one pick per group; also reopens to edit a combo line) */}
      <ComboPicker
        combo={editingComboLine ? editingCombo : pickingCombo}
        open={!!pickingCombo || !!editingComboLine}
        editing={editingComboLine}
        onClose={() => {
          setPickingCombo(null);
          setEditingComboLine(null);
        }}
        onAdd={addComboLine}
        onSave={updateComboLine}
      />

      <CustomItemDialog
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onConfirm={addLine}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Discard all items?"
        message="This removes every item from this order. It can't be undone."
        confirmLabel="Discard all"
        destructive
        onConfirm={() => {
          clearDraft();
          setConfirmClear(false);
          toast("Cleared all items.", "success");
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </>
  );
}
