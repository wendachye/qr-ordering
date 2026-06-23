"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Boxes, History, Loader2, Minus, Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { EmptyState } from "@/components/common/EmptyState";
import { useInventoryMutations } from "@/hooks/useMenuMutations";
import { inventoryApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/lib/types";

// Stock state of one tracked item, used to drive badges + sort priority.
type StockState = "out" | "low" | "ok" | "untracked";

function stockState(item: MenuItem): StockState {
  if (!item.trackStock) return "untracked";
  if (item.stockQty <= 0) return "out";
  if (item.lowStockThreshold != null && item.stockQty <= item.lowStockThreshold) return "low";
  return "ok";
}

// Out-of-stock first, then low, then healthy tracked, then untracked.
const SORT_RANK: Record<StockState, number> = { out: 0, low: 1, ok: 2, untracked: 3 };

function StockBadge({ state }: { state: StockState }) {
  if (state === "out") return <Badge tone="red">Out of stock</Badge>;
  if (state === "low") return <Badge tone="amber">Low</Badge>;
  if (state === "ok") return <Badge tone="green">In stock</Badge>;
  return <Badge tone="gray">Not tracked</Badge>;
}

// The inventory screen: a scannable, severity-sorted list of every menu item
// with a per-item Manage dialog (config + restock/waste + recent ledger).
export function InventoryManager({ items }: { items: MenuItem[] }) {
  const [manageId, setManageId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        const r = SORT_RANK[stockState(a)] - SORT_RANK[stockState(b)];
        return r !== 0 ? r : a.name.localeCompare(b.name);
      }),
    [items]
  );

  const alertCount = useMemo(
    () => items.filter((i) => ["out", "low"].includes(stockState(i))).length,
    [items]
  );
  const outCount = useMemo(
    () => items.filter((i) => stockState(i) === "out").length,
    [items]
  );

  const manageItem = items.find((i) => i.id === manageId) ?? null;

  if (items.length === 0) {
    return (
      <EmptyState
        title="No items yet"
        description="Add menu items first, then turn on stock tracking to manage inventory here."
      />
    );
  }

  return (
    <>
      {/* Sticky low/out summary. */}
      <div className="sticky top-0 z-10 -mx-1 mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-white/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <Boxes className="h-4 w-4 text-slate-400" />
        {alertCount === 0 ? (
          <span className="text-sm font-medium text-slate-600">
            All tracked items are in stock.
          </span>
        ) : (
          <span className="text-sm font-semibold text-slate-700">
            {alertCount} {alertCount === 1 ? "item" : "items"} low / out of stock
            {outCount > 0 && (
              <span className="font-normal text-slate-500"> · {outCount} out</span>
            )}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {sorted.map((item) => {
          const state = stockState(item);
          return (
            <Card key={item.id} className={cn(state === "out" && "border-red-200")}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                    <span className="truncate">{item.name}</span>
                    <StockBadge state={state} />
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {item.categoryName}
                    {item.trackStock ? (
                      <>
                        {" · "}
                        <span
                          className={cn(
                            "font-semibold",
                            state === "out"
                              ? "text-red-600"
                              : state === "low"
                                ? "text-amber-600"
                                : "text-slate-700"
                          )}
                        >
                          {item.stockQty} in stock
                        </span>
                        {item.lowStockThreshold != null &&
                          ` · alert at ${item.lowStockThreshold}`}
                      </>
                    ) : (
                      " · stock not tracked"
                    )}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setManageId(item.id)}>
                  {item.trackStock ? (
                    <>
                      <Settings2 className="h-4 w-4" />
                      Manage
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Track stock
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ModalDialog
        open={!!manageItem}
        onClose={() => setManageId(null)}
        title={manageItem ? `Manage stock · ${manageItem.name}` : "Manage stock"}
        className="sm:max-w-lg"
      >
        {manageItem && (
          <ManageStockForm
            key={manageItem.id}
            item={manageItem}
            onClose={() => setManageId(null)}
          />
        )}
      </ModalDialog>
    </>
  );
}

// The per-item dialog body: config (track/qty/threshold) + restock/waste + ledger.
function ManageStockForm({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const { adjust, config } = useInventoryMutations();

  const [trackStock, setTrackStock] = useState(item.trackStock);
  const [stockQty, setStockQty] = useState(String(item.stockQty));
  const [threshold, setThreshold] = useState(
    item.lowStockThreshold != null ? String(item.lowStockThreshold) : ""
  );

  // Quick restock / waste controls.
  const [adjustQty, setAdjustQty] = useState("1");
  const [adjustNote, setAdjustNote] = useState("");

  const ledgerQuery = useQuery({
    queryKey: ["inventory-ledger", item.id],
    queryFn: () => inventoryApi.ledger(item.id),
  });

  const saveConfig = () => {
    const qty = Number(stockQty);
    const thr = threshold.trim() === "" ? null : Number(threshold);
    config.mutate({
      id: item.id,
      input: {
        trackStock,
        stockQty: Number.isFinite(qty) ? qty : 0,
        lowStockThreshold: thr != null && Number.isFinite(thr) ? thr : null,
      },
    });
  };

  const runAdjust = (reason: "restock" | "waste") => {
    const n = Math.abs(Math.trunc(Number(adjustQty)));
    if (!n) return;
    adjust.mutate({
      id: item.id,
      input: {
        delta: reason === "restock" ? n : -n,
        reason,
        ...(adjustNote.trim() ? { note: adjustNote.trim() } : {}),
      },
    });
  };

  const busy = config.isPending || adjust.isPending;

  return (
    <div className="space-y-5">
      {/* Tracking config. */}
      <div className="space-y-4 rounded-lg border bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="mb-0">Track stock</Label>
            <p className="text-xs text-slate-500">
              When on, hitting 0 marks the item sold out automatically.
            </p>
          </div>
          <Switch checked={trackStock} onCheckedChange={setTrackStock} />
        </div>

        <div
          className={cn(
            "grid grid-cols-2 gap-3 transition-opacity",
            !trackStock && "pointer-events-none opacity-50"
          )}
        >
          <div>
            <Label htmlFor="stock-qty">Stock count</Label>
            <Input
              id="stock-qty"
              type="number"
              inputMode="numeric"
              min={0}
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
              disabled={!trackStock}
            />
          </div>
          <div>
            <Label htmlFor="stock-threshold">Low-stock alert</Label>
            <Input
              id="stock-threshold"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="No alert"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              disabled={!trackStock}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={saveConfig} disabled={busy}>
            {config.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* Quick restock / waste — only meaningful when tracking. */}
      {trackStock && (
        <div className="space-y-3 rounded-lg border p-4">
          <Label className="mb-0">Quick adjustment</Label>
          <div className="flex items-end gap-3">
            <div className="w-24">
              <Label htmlFor="adjust-qty" className="text-xs text-slate-500">
                Quantity
              </Label>
              <Input
                id="adjust-qty"
                type="number"
                inputMode="numeric"
                min={1}
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
              />
            </div>
            <Input
              aria-label="Note (optional)"
              placeholder="Note (optional)"
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
              className="flex-1"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="success"
              size="sm"
              className="flex-1"
              onClick={() => runAdjust("restock")}
              disabled={busy || !Number(adjustQty)}
            >
              <Plus className="h-4 w-4" />
              Restock
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={() => runAdjust("waste")}
              disabled={busy || !Number(adjustQty)}
            >
              <Minus className="h-4 w-4" />
              Waste
            </Button>
          </div>
        </div>
      )}

      {/* Recent ledger. */}
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <History className="h-4 w-4 text-slate-400" />
          Recent movements
        </p>
        {ledgerQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : ledgerQuery.isError ? (
          <p className="py-4 text-center text-sm text-red-600">
            {ledgerQuery.error instanceof ApiError
              ? ledgerQuery.error.message
              : "Could not load the ledger."}
          </p>
        ) : (ledgerQuery.data ?? []).length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No movements yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {(ledgerQuery.data ?? []).map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium capitalize text-slate-700">
                    {row.reason}
                    {row.note && (
                      <span className="font-normal text-slate-500"> · {row.note}</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {new Date(row.createdAt).toLocaleString()}
                    {row.actorEmail && ` · ${row.actorEmail}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      row.delta >= 0 ? "text-green-700" : "text-red-600"
                    )}
                  >
                    {row.delta >= 0 ? `+${row.delta}` : row.delta}
                  </span>
                  <p className="text-xs text-slate-400 tabular-nums">→ {row.balanceAfter}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
