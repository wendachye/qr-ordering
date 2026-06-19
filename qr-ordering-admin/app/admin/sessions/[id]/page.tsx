"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowLeftRight,
  Ban,
  GitMerge,
  MoreHorizontal,
  Printer,
  ShoppingBag,
  Users,
} from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalDialog } from "@/components/ui/modal-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SessionActions } from "@/components/orders/SessionActions";
import { MenuBrowser } from "@/components/pos/MenuBrowser";
import { OptionPicker } from "@/components/pos/OptionPicker";
import { CustomItemDialog } from "@/components/pos/CustomItemDialog";
import { CartLineList } from "@/components/pos/CartLineList";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { useToast } from "@/components/common/Toast";
import { useDraftCart } from "@/hooks/useDraftCart";
import { useSessionMutations } from "@/hooks/useSessionMutations";
import { ordersApi, sessionsApi, settingsApi, publicApi } from "@/lib/endpoints";
import { ApiError, newIdempotencyKey } from "@/lib/api";
import { ChargeBreakdown } from "@/components/orders/ChargeBreakdown";
import { cn } from "@/lib/cn";
import { formatDateTime, formatPrice, formatRelative, formatTime } from "@/lib/format";
import {
  cartItemCount,
  cartLineToPlaceOrderItem,
  cartTotal,
  type CartLine,
} from "@/lib/pos";
import type {
  FloorEntry,
  PublicMenuItem,
  SessionDetail,
  SessionRound,
  SessionRoundItem,
  SessionStatus,
} from "@/lib/types";

const SESSION_TONE: Record<SessionStatus, "accent" | "green" | "gray"> = {
  OPEN: "accent",
  CLOSED: "green",
  CANCELLED: "gray",
  MERGED: "gray",
};

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const query = useQuery({
    queryKey: ["session", id],
    queryFn: () => sessionsApi.get(id),
    refetchInterval: 5000,
  });

  return (
    <AdminShell>
      <div className="mb-4">
        <Link
          href="/admin/floor"
          className="inline-flex items-center gap-1 text-base font-semibold text-accent-700 hover:text-accent-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Floor
        </Link>
      </div>

      {query.isLoading ? (
        <LoadingState label="Loading table…" />
      ) : query.isError ? (
        <ErrorState
          message={
            query.error instanceof ApiError
              ? query.error.message
              : "Could not load this table."
          }
          onRetry={() => query.refetch()}
        />
      ) : query.data ? (
        query.data.status === "OPEN" ? (
          <TableWorkspace session={query.data} />
        ) : (
          <ClosedSessionView session={query.data} />
        )
      ) : null}
    </AdminShell>
  );
}

/* ----- Open table: menu + running tab + add-items, all on one screen ----- */
function TableWorkspace({ session }: { session: SessionDetail }) {
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

  const menuQuery = useQuery({
    queryKey: ["public-menu", session.table.code],
    queryFn: () => publicApi.menu(session.table.code),
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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_26rem]">
      {/* Menu (left) */}
      <div className="min-h-[60vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-[calc(100vh-10rem)]">
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
                <span className="text-xs font-medium text-slate-400">
                  {cartItemCount(cart)} to send
                </span>
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
                size="lg"
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

// Inline guest-count editor for the running tab. null → "Set pax"; otherwise a
// compact −/+ stepper. Each change persists immediately (optimistic).
function PaxControl({
  pax,
  onChange,
  busy,
}: {
  pax: number | null;
  onChange: (n: number) => void;
  busy?: boolean;
}) {
  if (pax == null) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => onChange(2)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1 text-sm font-semibold text-slate-500 transition-colors hover:border-accent-300 hover:text-accent-700 disabled:opacity-50"
      >
        <Users className="h-4 w-4" />
        Set pax
      </button>
    );
  }
  const step = (delta: number, label: string, disabled: boolean) => (
    <button
      type="button"
      aria-label={delta > 0 ? "More guests" : "Fewer guests"}
      disabled={disabled}
      onClick={() => onChange(pax + delta)}
      className="flex h-6 w-6 items-center justify-center rounded-md text-lg font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40"
    >
      {label}
    </button>
  );
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5 py-1">
      <Users className="mr-0.5 h-4 w-4 text-slate-400" />
      {step(-1, "−", !!busy || pax <= 1)}
      <span className="w-6 text-center text-sm font-bold tabular-nums text-slate-800">
        {pax}
      </span>
      {step(1, "+", !!busy || pax >= 99)}
      <span className="ml-0.5 mr-1 text-xs font-medium text-slate-400">pax</span>
    </div>
  );
}

function TabRound({
  round,
  onReprint,
  reprinting,
  onVoid,
}: {
  round: SessionRound;
  onReprint: () => void;
  reprinting: boolean;
  onVoid: (item: SessionRoundItem) => void;
}) {
  const cancelled = round.status === "CANCELLED";
  return (
    <li
      className={cn(
        "rounded-xl border border-slate-100 bg-slate-50/60 p-3",
        cancelled && "opacity-50"
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {round.roundNumber ? `Round ${round.roundNumber}` : "Round"} ·{" "}
          {formatTime(round.createdAt)}
        </span>
        <div className="flex items-center gap-2">
          {cancelled && <Badge tone="gray">Cancelled</Badge>}
          <button
            type="button"
            onClick={onReprint}
            disabled={reprinting}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-50"
          >
            <Printer className="h-3.5 w-3.5" />
            Reprint
          </button>
        </div>
      </div>
      <ul className="space-y-1">
        {round.items.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-2 text-sm"
          >
            <div className="min-w-0">
              <span
                className={cn(
                  "text-slate-800",
                  item.voided && "text-slate-400 line-through"
                )}
              >
                <span className="font-semibold">{item.quantity}×</span> {item.name}
                {item.isTakeaway && (
                  <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-sky-100 px-1 py-0.5 text-[10px] font-bold uppercase text-sky-700">
                    <ShoppingBag className="h-2.5 w-2.5" />
                    TA
                  </span>
                )}
                {item.priceOverridden && (
                  <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                    $
                  </span>
                )}
                {item.discountAmount > 0 && (
                  <span className="ml-1 rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                    {item.discountType === "PERCENT"
                      ? `${item.discountValue}%`
                      : `−${formatPrice(item.discountAmount)}`}
                  </span>
                )}
                {item.selectedOptions.length > 0 && (
                  <span className="text-slate-400">
                    {" · "}
                    {item.selectedOptions.map((o) => o.choice).join(", ")}
                  </span>
                )}
              </span>
              {item.note && (
                <span className="block text-xs italic text-amber-700">
                  Remarks: {item.note}
                </span>
              )}
              {item.voided && (
                <span className="block text-xs font-semibold uppercase tracking-wide text-red-500">
                  Voided{item.voidReason ? ` · ${item.voidReason}` : ""}
                </span>
              )}
            </div>
            {item.voided ? (
              <span className="shrink-0 text-xs font-bold uppercase text-red-400">
                Void
              </span>
            ) : (
              <div className="flex shrink-0 items-center gap-1.5">
                {item.discountAmount > 0 && (
                  <span className="text-xs text-slate-400 line-through">
                    {formatPrice(item.totalPrice + item.discountAmount)}
                  </span>
                )}
                <span className="font-medium text-slate-600">
                  {formatPrice(item.totalPrice)}
                </span>
                {!cancelled && (
                  <button
                    type="button"
                    onClick={() => onVoid(item)}
                    aria-label={`Void ${item.name}`}
                    className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Ban className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </li>
  );
}

// Void an item: optional reason (with presets) + the manager PIN when required.
function VoidDialog({
  item,
  voidPinRequired,
  busy,
  onClose,
  onConfirm,
}: {
  item: SessionRoundItem | null;
  voidPinRequired: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string | undefined, pin: string | undefined) => void;
}) {
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  useEffect(() => {
    setReason("");
    setPin("");
  }, [item?.id]);

  const PRESETS = ["Out of stock", "Customer cancelled", "Wrong order"];

  return (
    <ModalDialog
      open={!!item}
      onClose={onClose}
      title={item ? `Void ${item.name}?` : ""}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Removes the item from the bill. It stays on the tab, struck through.
        </p>
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">
            Reason (optional)
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason((cur) => (cur === r ? "" : r))}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  reason === r
                    ? "border-accent-500 bg-accent-50 text-accent-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <Input
            className="mt-2"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Or type a reason…"
          />
        </div>
        {voidPinRequired && (
          <div>
            <Label htmlFor="void-pin">Manager PIN</Label>
            <Input
              id="void-pin"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Required to void"
            />
          </div>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy || (voidPinRequired && !pin)}
            onClick={() =>
              onConfirm(
                reason.trim() ? reason.trim() : undefined,
                voidPinRequired ? pin : undefined
              )
            }
          >
            {busy ? "Voiding…" : "Void item"}
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
}

// Floor-plan style table picker used by the Move / Combine dialogs. Shows every
// table as a tile; only valid targets are enabled (free for move, other open
// tabs for combine), the rest are dimmed so staff can still see the layout.
function TablePickerGrid({
  entries,
  mode,
  currentSessionId,
  busy,
  onPick,
}: {
  entries: FloorEntry[];
  mode: "move" | "combine";
  currentSessionId: string;
  busy: boolean;
  onPick: (entry: FloorEntry) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {entries.map((e) => {
        const occupied = !!e.session;
        const isCurrent = e.session?.id === currentSessionId;
        const selectable =
          mode === "move"
            ? !occupied && e.table.isActive
            : occupied && !isCurrent;
        return (
          <button
            key={e.table.id}
            type="button"
            disabled={!selectable || busy}
            onClick={() => onPick(e)}
            className={cn(
              "flex min-h-[5.5rem] flex-col rounded-xl border p-3 text-left transition",
              !selectable
                ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-55"
                : occupied
                  ? "border-accent-300 bg-accent-50/70 hover:border-accent-500 hover:shadow-md active:scale-[0.99]"
                  : "border-green-300 bg-white hover:border-accent-400 hover:bg-accent-50 hover:shadow-md active:scale-[0.99]"
            )}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  occupied
                    ? "bg-accent-500"
                    : e.table.isActive
                      ? "bg-green-500"
                      : "bg-slate-300"
                )}
                aria-hidden
              />
              <span className="truncate text-sm font-bold text-slate-900">
                {e.table.name}
              </span>
            </div>
            <div className="mt-auto pt-1.5">
              {isCurrent ? (
                <span className="text-xs font-semibold text-accent-600">
                  This tab
                </span>
              ) : occupied ? (
                <>
                  <p className="text-sm font-black leading-none text-slate-900">
                    {formatPrice(e.session!.total)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {e.session!.roundCount}{" "}
                    {e.session!.roundCount === 1 ? "round" : "rounds"}
                  </p>
                </>
              ) : e.table.isActive ? (
                <span className="text-xs font-semibold text-green-600">Free</span>
              ) : (
                <span className="text-xs font-medium text-slate-400">Inactive</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ----- Closed / cancelled tab: read-only summary ----- */
function ClosedSessionView({ session }: { session: SessionDetail }) {
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black text-slate-900">
                {session.table.name}
              </h1>
              <p className="mt-1 font-mono text-sm text-slate-400">
                {session.table.code} · Session #{session.sessionNumber}
              </p>
              <p className="mt-1 text-slate-500">
                Closed {formatDateTime(session.closedAt ?? session.openedAt)}
                {session.paymentMethod ? ` · Paid by ${session.paymentMethod}` : ""}
              </p>
            </div>
            <Badge tone={SESSION_TONE[session.status]}>{session.status}</Badge>
          </div>
          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">
                {session.roundCount} {session.roundCount === 1 ? "round" : "rounds"} ·{" "}
                {session.totalItems} {session.totalItems === 1 ? "item" : "items"}
                {session.pax ? ` · ${session.pax} pax` : ""}
              </span>
              <span
                className={cn(
                  "font-black text-slate-900",
                  session.discount > 0 ? "text-lg font-semibold text-slate-500" : "text-2xl"
                )}
              >
                {formatPrice(session.total)}
              </span>
            </div>
            {session.discount > 0 && (
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center justify-between text-emerald-700">
                  <span className="text-sm font-semibold">
                    Discount
                    {session.discountType === "PERCENT"
                      ? ` (${session.discountValue}%)`
                      : ""}
                  </span>
                  <span className="text-sm font-bold">
                    −{formatPrice(session.discount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Net total</span>
                  <span className="text-2xl font-black text-slate-900">
                    {formatPrice(session.netTotal)}
                  </span>
                </div>
              </div>
            )}
            <ChargeBreakdown total={session.netTotal} settings={settingsQuery.data} />
          </div>
        </CardContent>
      </Card>

      {session.rounds.map((round) => (
        <Card
          key={round.id}
          className={cn(round.status === "CANCELLED" && "opacity-60")}
        >
          <CardContent>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                {round.roundNumber ? `Round ${round.roundNumber}` : "Round"}
              </h2>
              <span className="text-sm text-slate-400">
                #{round.orderNumber} · {formatTime(round.createdAt)}
              </span>
              {round.status === "CANCELLED" && <Badge tone="gray">Cancelled</Badge>}
            </div>
            <ul className="divide-y divide-slate-100">
              {round.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-4 py-2"
                >
                  <span
                    className={cn(
                      "text-slate-800",
                      item.voided && "text-slate-400 line-through"
                    )}
                  >
                    <span className="font-semibold">{item.quantity}×</span>{" "}
                    {item.name}
                    {item.selectedOptions.length > 0 && (
                      <span className="text-slate-400">
                        {" · "}
                        {item.selectedOptions.map((o) => o.choice).join(", ")}
                      </span>
                    )}
                    {item.discountAmount > 0 && (
                      <span className="ml-1 rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                        {item.discountType === "PERCENT"
                          ? `${item.discountValue}%`
                          : `−${formatPrice(item.discountAmount)}`}
                      </span>
                    )}
                  </span>
                  {item.voided ? (
                    <span className="shrink-0 text-xs font-bold uppercase text-red-400">
                      Void
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1.5">
                      {item.discountAmount > 0 && (
                        <span className="text-xs text-slate-400 line-through">
                          {formatPrice(item.totalPrice + item.discountAmount)}
                        </span>
                      )}
                      <span className="font-semibold text-slate-700">
                        {formatPrice(item.totalPrice)}
                      </span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
