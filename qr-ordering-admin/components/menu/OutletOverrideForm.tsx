"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useItemMutations } from "@/hooks/useMenuMutations";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import type { MenuItem } from "@/lib/types";

// Per-outlet override editor for one shared-catalogue item. Each control either
// inherits the catalogue value or sets THIS outlet's own — price, sold-out, and
// "offered here". Self-contained (owns its mutation), mirroring ManageStockForm.
//
// Availability is tri-state: inherit | available here | sold out here. "Offered
// here" is the catalogue opt-out (false hides the item at this outlet only).

type Availability = "inherit" | "available" | "soldout";

export function OutletOverrideForm({
  item,
  outletName,
  onClose,
}: {
  item: MenuItem;
  outletName: string | null;
  onClose: () => void;
}) {
  const { setOutletState } = useItemMutations();

  const [priceOn, setPriceOn] = useState(item.outletPrice != null);
  const [priceVal, setPriceVal] = useState(
    item.outletPrice != null ? String(item.outletPrice) : ""
  );
  const [availability, setAvailability] = useState<Availability>(
    item.outletAvailable == null ? "inherit" : item.outletAvailable ? "available" : "soldout"
  );
  const [offered, setOffered] = useState(item.outletActive !== false);

  const here = outletName ? `at ${outletName}` : "at this outlet";

  const save = () => {
    const n = Number(priceVal);
    const price =
      priceOn && priceVal.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
    const isAvailable =
      availability === "inherit" ? null : availability === "available";
    // Offered on → inherit (null); off → explicitly hidden here (false).
    const isActive = offered ? null : false;
    setOutletState.mutate(
      { id: item.id, input: { price, isAvailable, isActive } },
      { onSuccess: onClose }
    );
  };

  const busy = setOutletState.isPending;

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        Customise this item {here} without changing the shared catalogue. Cleared
        fields inherit the catalogue value.
      </p>

      {/* Price override. */}
      <div className="space-y-3 rounded-lg border bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="mb-0">Set a price {here}</Label>
            <p className="text-xs text-slate-500">
              Catalogue price: {formatPrice(item.price)}
            </p>
          </div>
          <Switch checked={priceOn} onCheckedChange={setPriceOn} />
        </div>
        {priceOn && (
          <div>
            <Label htmlFor="outlet-price">Outlet price (RM)</Label>
            <Input
              id="outlet-price"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder={String(item.price)}
              value={priceVal}
              onChange={(e) => setPriceVal(e.target.value)}
              autoFocus
            />
          </div>
        )}
      </div>

      {/* Availability override (tri-state). */}
      <div className="space-y-2 rounded-lg border p-4">
        <Label className="mb-0">Availability {here}</Label>
        <p className="text-xs text-slate-500">
          Catalogue: {item.isAvailable ? "available" : "sold out"}.
        </p>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {(
            [
              ["inherit", "Follow catalogue"],
              ["available", "Available"],
              ["soldout", "Sold out"],
            ] as [Availability, string][]
          ).map(([val, label]) => (
            <Button
              key={val}
              type="button"
              variant={availability === val ? "default" : "secondary"}
              size="sm"
              aria-pressed={availability === val}
              onClick={() => setAvailability(val)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Offered-here (catalogue opt-out). */}
      <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
        <div>
          <Label className="mb-0">Offered {here}</Label>
          <p className="text-xs text-slate-500">
            Turn off to hide this catalogue item {here} (it stays on the menu
            elsewhere).
          </p>
        </div>
        <Switch checked={offered} onCheckedChange={setOffered} />
      </div>

      <div className={cn("flex justify-end gap-3")}>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save override"}
        </Button>
      </div>
    </div>
  );
}
