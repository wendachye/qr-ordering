"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  GitMerge,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ModalDialog } from "@/components/ui/modal-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SessionActions } from "@/components/sessions/SessionActions";
import { MenuBrowser } from "@/components/pos/MenuBrowser";
import { OptionPicker } from "@/components/pos/OptionPicker";
import { CustomItemDialog } from "@/components/pos/CustomItemDialog";
import { CartLineList } from "@/components/pos/CartLineList";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { useToast } from "@/components/common/Toast";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useDraftCart } from "@/hooks/useDraftCart";
import { useSessionMutations } from "@/hooks/useSessionMutations";
import { ordersApi, sessionsApi, settingsApi, posMenuApi } from "@/lib/endpoints";
import { ApiError, newIdempotencyKey } from "@/lib/api";
import { formatPrice, formatRelative } from "@/lib/format";
import {
  cartItemCount,
  cartLineToPlaceOrderItem,
  cartTotal,
  type CartLine,
} from "@/lib/pos";
import type {
  PublicMenuItem,
  SessionDetail,
  SessionRoundItem,
} from "@/lib/types";
import { PaxControl } from "@/components/sessions/PaxControl";
import { TabRound } from "@/components/sessions/TabRound";
import { VoidDialog } from "@/components/sessions/VoidDialog";
import { TablePickerGrid } from "@/components/sessions/TablePickerGrid";

/* ----- Open table: menu + running tab + add-items, all on one screen ----- */
export function TableWorkspace({ session }: { session: SessionDetail }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { reprint, setPax, voidItem, move, combine } = useSessionMutations();

  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });
  const paymentMethods = settingsQuery.data?.paymentMethods ?? [];
  // Only require the void PIN when an override PIN actually exists — a
  // requirement can't be enforced without a PIN that's been set.
  const voidPinRequired =
    !!settingsQuery.data?.pinConfigured && !!settingsQuery.data?.voidPinRequired;
  const [voiding, setVoiding] = useState<SessionRoundItem | null>(null);

  // Floor list powers the Move (free tables) / Combine (other open tabs) pickers.
  const floorQuery = useQuery({ queryKey: ["floor"], queryFn: sessionsApi.floor });
  const floor = floorQuery.data ?? [];
  const freeTables = floor.filter((e) => !e.session && e.table.isActive);
  const otherOpenTabs = floor.filter((e) => e.session && e.session.id !== session.id);
  const [tableOp, setTableOp] = useState<"move" | "combine" | null>(null);

  // POS menu (includes POS-only "secret" items) for this table.
  const menuQuery = useQuery({
    queryKey: ["pos-menu", session.table.code],
    queryFn: () => posMenuApi.get(session.table.code),
  });
  const menuItems = useMemo(
    () => menuQuery.data?.categories.flatMap((c) => c.items) ?? [],
    [menuQuery.data]
  );

  // Unsent items live in a per-table draft (localStorage) so they survive going
  // back to the Floor / a reload — cleared only once the round is sent.
  const {
    cart,
    setCart,
    note: orderNote,
    setNote: setOrderNote,
    clearDraft,
  } = useDraftCart(session.id);
  const [picking, setPicking] = useState<PublicMenuItem | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  // A cart line being edited (reopens the picker seeded from that line).
  const [editingLine, setEditingLine] = useState<CartLine | null>(null);
  const editingItem = editingLine
    ? menuItems.find((m) => m.id === editingLine.menuItemId) ?? null
    : null;

  const idemKeyRef = useRef<string | null>(null);
  const placeOrder = useMutation({
    mutationFn: () => {
      if (!idemKeyRef.current) idemKeyRef.current = newIdempotencyKey();
      return ordersApi.create(
        {
          tableCode: session.table.code,
          note: orderNote.trim() ? orderNote.trim() : undefined,
          items: cart.map(cartLineToPlaceOrderItem),
        },
        idemKeyRef.current
      );
    },
    onSuccess: (res) => {
      idemKeyRef.current = null;
      toast(`Sent to kitchen — order #${res.orderNumber}`, "success");
      clearDraft();
      // Stay here; refetch so the new round appears under "On the tab".
      queryClient.invalidateQueries({ queryKey: ["session", session.id] });
      queryClient.invalidateQueries({ queryKey: ["floor"] });
    },
    onError: (err) =>
      toast(
        err instanceof ApiError ? err.message : "Could not send the order.",
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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_20rem] lg:grid-cols-[1fr_22rem] xl:grid-cols-[1fr_26rem]">
      {/* Menu (left) */}
      <div className="min-h-[60vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:h-[calc(100vh-10rem)]">
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
          <MenuBrowser
            categories={menuQuery.data?.categories ?? []}
            onPick={setPicking}
            onAddCustom={() => setCustomOpen(true)}
          />
        )}
      </div>

      {/* Tab + new items — one card, all actions grouped at the bottom (right) */}
      <div className="lg:sticky lg:top-24 lg:h-[calc(100vh-10rem)]">
        <div className="flex h-full min-h-[60vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Header — table + running tab total */}
          <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-5 py-4">
            <div>
              <h1 className="text-xl font-black text-slate-900">
                {session.table.name}
              </h1>
              <p className="text-sm text-slate-500">
                Open {formatRelative(session.openedAt)} · {session.totalItems}{" "}
                {session.totalItems === 1 ? "item" : "items"}
              </p>
              <div className="mt-2">
                <PaxControl
                  pax={session.pax}
                  busy={setPax.isPending}
                  onChange={(n) => setPax.mutate({ id: session.id, pax: n })}
                />
              </div>
            </div>
            <div className="flex items-start gap-1">
              <div className="text-right">
                <p className="text-xl font-black text-slate-900">
                  {formatPrice(session.total)}
                </p>
                <p className="text-xs font-medium text-slate-400">on the tab</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Table actions"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onSelect={() => setTableOp("move")}>
                    <ArrowLeftRight />
                    Move to another table
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setTableOp("combine")}>
                    <GitMerge />
                    Combine another table
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Scroll — what's ordered, then what's being added */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              On the tab
            </p>
            {session.rounds.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 py-4 text-center text-sm text-slate-400">
                Nothing sent yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {session.rounds.map((round) => (
                  <TabRound
                    key={round.id}
                    round={round}
                    onReprint={() =>
                      reprint.mutate({ orderId: round.id, sessionId: session.id })
                    }
                    reprinting={reprint.isPending}
                    onVoid={setVoiding}
                  />
                ))}
              </ul>
            )}

            <div className="mb-2 mt-5 flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">
                New items
              </p>
              {cart.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-400">
                    {cartItemCount(cart)} to send
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="text-xs font-semibold text-red-600 hover:text-red-700"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
            {cart.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 py-4 text-center text-sm text-slate-400">
                Tap a menu item to add it here.
              </p>
            ) : (
              <CartLineList
                lines={cart}
                onQtyChange={changeQty}
                onRemove={removeLine}
                onEdit={setEditingLine}
              />
            )}
          </div>

          {/* Footer — note + all actions grouped */}
          <div className="border-t border-slate-200 px-4 py-3">
            <Label htmlFor="order-note">Order note (optional)</Label>
            <Textarea
              id="order-note"
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              placeholder="e.g. allergy info, serve together…"
              className="min-h-[52px]"
            />

            {cart.length > 0 && (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">
                  New items total
                </span>
                <span className="text-lg font-black text-slate-900">
                  {formatPrice(cartTotal(cart))}
                </span>
              </div>
            )}

            <div className="mt-3 flex flex-col gap-2">
              <Button
                disabled={cart.length === 0 || placeOrder.isPending}
                onClick={() => placeOrder.mutate()}
              >
                {placeOrder.isPending ? "Sending…" : "Send to kitchen"}
              </Button>
              <SessionActions
                sessionId={session.id}
                sessionNumber={session.sessionNumber}
                status={session.status}
                total={session.total}
                amountPaid={session.amountPaid}
                balanceDue={session.balanceDue}
                paymentMethods={paymentMethods}
                attachedVoucher={session.voucherCode}
              />
            </div>

            {cart.length > 0 && (
              <p className="mt-2 text-center text-xs text-slate-400">
                Saved to this table — these stay here until you send them.
              </p>
            )}
          </div>
        </div>
      </div>

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

      <ConfirmDialog
        open={confirmClear}
        title="Discard new items?"
        message="This removes every unsent item from this table. Items already sent to the kitchen are not affected."
        confirmLabel="Discard all"
        destructive
        onConfirm={() => {
          clearDraft();
          setConfirmClear(false);
          toast("Cleared unsent items.", "success");
        }}
        onCancel={() => setConfirmClear(false)}
      />

      <VoidDialog
        item={voiding}
        voidPinRequired={voidPinRequired}
        busy={voidItem.isPending}
        onClose={() => setVoiding(null)}
        onConfirm={(reason, pin) =>
          voiding &&
          voidItem.mutate(
            { itemId: voiding.id, reason, pin },
            { onSuccess: () => setVoiding(null) }
          )
        }
      />

      {/* Move the tab to a free table — floor-plan picker */}
      <ModalDialog
        open={tableOp === "move"}
        onClose={() => setTableOp(null)}
        title="Move tab to another table"
        className="sm:max-w-2xl"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Pick a <span className="font-semibold text-green-600">free</span> table
            to move {session.table.name}&apos;s tab to.
          </p>
          <TablePickerGrid
            entries={floor}
            mode="move"
            currentSessionId={session.id}
            busy={move.isPending}
            onPick={(e) =>
              move.mutate(
                { id: session.id, targetTableId: e.table.id },
                { onSuccess: () => setTableOp(null) }
              )
            }
          />
          {freeTables.length === 0 && (
            <p className="text-center text-sm text-slate-400">
              No free tables — every table is occupied.
            </p>
          )}
        </div>
      </ModalDialog>

      {/* Combine another open tab into this one — floor-plan picker */}
      <ModalDialog
        open={tableOp === "combine"}
        onClose={() => setTableOp(null)}
        title={`Combine into ${session.table.name}`}
        className="sm:max-w-2xl"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Pick an <span className="font-semibold text-accent-700">open</span>{" "}
            table to pull into {session.table.name} — that table is then freed.
          </p>
          <TablePickerGrid
            entries={floor}
            mode="combine"
            currentSessionId={session.id}
            busy={combine.isPending}
            onPick={(e) =>
              combine.mutate(
                { id: session.id, sourceSessionId: e.session!.id },
                { onSuccess: () => setTableOp(null) }
              )
            }
          />
          {otherOpenTabs.length === 0 && (
            <p className="text-center text-sm text-slate-400">
              No other open tabs to combine.
            </p>
          )}
        </div>
      </ModalDialog>
    </div>
  );
}
