"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, Plus, ShoppingBag, Trash2, Utensils } from "lucide-react";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { QtyStepper } from "./QtyStepper";
import { settingsApi } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import {
  defaultSelection,
  isSelectionValid,
  nextLineId,
  selectionFromLine,
  selectionToOptions,
  toggleChoice,
  unitPriceFor,
  type CartLine,
} from "@/lib/pos";
import type { DiscountType, PublicMenuItem } from "@/lib/types";

// Option + quantity picker for a single menu item. Staff extras: takeaway
// (with/without packaging charge) and a price override gated by the admin
// password. When `editing` is passed it seeds from that line and saves back.
export function OptionPicker({
  item,
  open,
  onClose,
  onAdd,
  editing,
  onSave,
  takeawayCharge = 0,
}: {
  item: PublicMenuItem | null;
  open: boolean;
  onClose: () => void;
  onAdd: (line: CartLine) => void;
  editing?: CartLine | null;
  onSave?: (line: CartLine) => void;
  takeawayCharge?: number;
}) {
  return (
    <ModalDialog open={open && !!item} onClose={onClose} title={item?.name}>
      {item && (
        <PickerBody
          key={editing?.lineId ?? item.id}
          item={item}
          editing={editing ?? null}
          takeawayCharge={takeawayCharge}
          onClose={onClose}
          onSubmit={editing && onSave ? onSave : onAdd}
        />
      )}
    </ModalDialog>
  );
}

function PickerBody({
  item,
  editing,
  takeawayCharge,
  onClose,
  onSubmit,
}: {
  item: PublicMenuItem;
  editing: CartLine | null;
  takeawayCharge: number;
  onClose: () => void;
  onSubmit: (line: CartLine) => void;
}) {
  const [selection, setSelection] = useState<Record<string, string[]>>(() =>
    editing
      ? selectionFromLine(item, editing.optionChoiceIds)
      : defaultSelection(item)
  );
  const [quantity, setQuantity] = useState(editing?.quantity ?? 1);
  const [note, setNote] = useState(editing?.note ?? "");

  // Ad-hoc custom add-ons / special requests (name + price). Free-form rows the
  // staff add per line; prices are kept as strings while editing.
  const [addons, setAddons] = useState<{ name: string; price: string }[]>(
    () => editing?.addons?.map((a) => ({ name: a.name, price: String(a.price) })) ?? []
  );
  const addAddon = () => setAddons((prev) => [...prev, { name: "", price: "" }]);
  const updateAddon = (i: number, patch: Partial<{ name: string; price: string }>) =>
    setAddons((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  const removeAddon = (i: number) =>
    setAddons((prev) => prev.filter((_, idx) => idx !== i));
  // Cleaned, priced add-ons used for pricing + submit (rows without a name drop).
  const cleanAddons = useMemo(
    () =>
      addons
        .map((a) => ({ name: a.name.trim(), price: Math.max(0, Number(a.price) || 0) }))
        .filter((a) => a.name.length > 0),
    [addons]
  );
  const addonsTotal = useMemo(
    () => cleanAddons.reduce((s, a) => s + a.price, 0),
    [cleanAddons]
  );

  // Takeaway (+ whether to apply the packaging charge).
  const [takeaway, setTakeaway] = useState(editing?.isTakeaway ?? false);
  const [applyCharge, setApplyCharge] = useState(
    editing ? (editing.takeawayCharge ?? 0) > 0 : true
  );

  // Whether price overrides / discounts require the override PIN (store
  // settings). Fail closed (require the PIN) until settings load.
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });
  // A requirement only applies once an override PIN exists — with no PIN set,
  // overrides/discounts are freely available (you can't gate behind a PIN that
  // isn't there). Until settings load, fail closed (require the PIN).
  const settings = settingsQuery.data;
  const discountPinRequired = settings ? settings.pinConfigured && settings.discountPinRequired : true;
  const overridePinRequired = settings ? settings.pinConfigured && settings.overridePinRequired : true;

  // Two INDEPENDENT PIN gates: price override is ALWAYS PIN-gated; the line
  // discount is gated only when discountPinRequired. One PIN unlocks both. A line
  // already carrying an override opens its override gate; one carrying a discount
  // opens its discount gate — crucially, a discount NEVER opens the override gate.
  const [unlocked, setUnlocked] = useState(!!editing?.priceOverridden);
  const [discountUnlocked, setDiscountUnlocked] = useState(!!editing?.discountType);
  const [overridden, setOverridden] = useState(editing?.priceOverridden ?? false);
  const [overridePrice, setOverridePrice] = useState(
    editing?.priceOverridden ? String(editing.unitPrice) : ""
  );
  const [discountType, setDiscountType] = useState<"" | DiscountType>(
    editing?.discountType ?? ""
  );
  const [discountValue, setDiscountValue] = useState(
    editing?.discountValue ? String(editing.discountValue) : ""
  );
  const [pwOpen, setPwOpen] = useState(false);
  const [pwValue, setPwValue] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  const options = useMemo(
    () => selectionToOptions(item, selection),
    [item, selection]
  );
  const basePrice = useMemo(
    () => unitPriceFor(item, options) + addonsTotal,
    [item, options, addonsTotal]
  );
  const valid = useMemo(
    () => isSelectionValid(item, selection),
    [item, selection]
  );

  const overrideNum = Number(overridePrice);
  const useOverride =
    overridden &&
    overridePrice.trim() !== "" &&
    !Number.isNaN(overrideNum) &&
    overrideNum >= 0;
  const effectiveUnit = useOverride ? overrideNum : basePrice;
  const chargeApplied = takeaway && applyCharge ? takeawayCharge : 0;
  const lineGross = (effectiveUnit + chargeApplied) * quantity;

  const discountNum = Number(discountValue);
  const useDiscount =
    discountType !== "" &&
    discountValue.trim() !== "" &&
    !Number.isNaN(discountNum) &&
    discountNum > 0;
  const discountAmt = useDiscount
    ? Math.round(
        Math.min(
          discountType === "PERCENT"
            ? (lineGross * Math.min(100, discountNum)) / 100
            : discountNum,
          lineGross
        ) * 100
      ) / 100
    : 0;
  const lineTotal = Math.round((lineGross - discountAmt) * 100) / 100;

  const choose = (groupId: string, choiceId: string) => {
    const group = item.optionGroups.find((g) => g.id === groupId);
    if (!group) return;
    setSelection((prev) => ({
      ...prev,
      [groupId]: toggleChoice(group, prev[groupId] ?? [], choiceId),
    }));
  };

  const unlock = async () => {
    if (!pwValue) return;
    setPwBusy(true);
    setPwError(null);
    try {
      const res = await settingsApi.verifyPin(pwValue);
      if (res.ok) {
        // One correct PIN authorises both gates for this dialog.
        setUnlocked(true);
        setDiscountUnlocked(true);
        setPwOpen(false);
        setPwValue("");
      } else if (!res.configured) {
        setPwError("No override PIN set yet — add one in Settings.");
      } else {
        setPwError("Incorrect PIN.");
      }
    } catch {
      setPwError("Couldn't verify — please try again.");
    } finally {
      setPwBusy(false);
    }
  };

  const clearOverride = () => {
    setOverridden(false);
    setOverridePrice("");
  };

  const submit = () => {
    if (!valid) return;
    onSubmit({
      lineId: editing?.lineId ?? nextLineId(),
      menuItemId: item.id,
      name: item.name,
      quantity,
      note: note.trim() ? note.trim() : undefined,
      optionChoiceIds: Object.values(selection).flat(),
      // Add-ons live in `options` too so they display + price in the cart.
      options: [
        ...options,
        ...cleanAddons.map((a) => ({
          group: "Add-on",
          choice: a.name,
          priceDelta: a.price,
        })),
      ],
      addons: cleanAddons.length ? cleanAddons : undefined,
      unitPrice: effectiveUnit,
      isTakeaway: takeaway,
      takeawayCharge: chargeApplied,
      priceOverridden: useOverride,
      discountType: useDiscount ? (discountType as DiscountType) : undefined,
      discountValue: useDiscount ? discountNum : undefined,
    });
  };

  // Discount control — rendered either inside the PIN gate (when required) or
  // inline (when the store doesn't require a PIN for discounts).
  const discountFields = (
    <div>
      <Label className="mb-1.5">Discount</Label>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
          {(
            [
              ["", "None"],
              ["PERCENT", "% off"],
              ["FIXED", "$ off"],
            ] as const
          ).map(([val, label]) => (
            <Button
              key={val || "none"}
              type="button"
              variant={discountType === val ? "default" : "ghost"}
              onClick={() => {
                // Clear the value on a real type change so an RM amount is never
                // silently reinterpreted as a percentage (or kept after "None").
                if (val !== discountType) setDiscountValue("");
                setDiscountType(val);
              }}
              className={cn(
                "h-auto rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                discountType === val
                  ? "bg-accent-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {label}
            </Button>
          ))}
        </div>
        {discountType !== "" && (
          <div className="flex items-center gap-1">
            {discountType === "FIXED" && (
              <span className="text-sm font-medium text-slate-500">$</span>
            )}
            <Input
              type="number"
              min="0"
              step={discountType === "PERCENT" ? "1" : "0.10"}
              max={discountType === "PERCENT" ? "100" : undefined}
              value={discountValue}
              autoFocus
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === "PERCENT" ? "10" : "5.00"}
              className="h-10 w-24 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-base font-bold text-slate-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
            />
            {discountType === "PERCENT" && (
              <span className="text-sm font-medium text-slate-500">%</span>
            )}
          </div>
        )}
      </div>
      {useDiscount && (
        <p className="mt-1 text-xs font-semibold text-emerald-700">
          −{formatPrice(discountAmt)} off this line
        </p>
      )}
    </div>
  );

  // Affordance / gate visibility. Each of override + discount is PIN-gated only
  // when its store setting says so. One correct PIN unlocks both.
  const overrideReady = !overridePinRequired || unlocked;
  const needOverrideUnlock = overridePinRequired && !unlocked;
  const needDiscountUnlock = discountPinRequired && !discountUnlocked;
  const showUnlock = needOverrideUnlock || needDiscountUnlock;
  const unlockLabel =
    needOverrideUnlock && needDiscountUnlock
      ? "Override / discount"
      : needOverrideUnlock
        ? "Override price"
        : "Add discount";
  const unlockHint =
    unlockLabel === "Add discount"
      ? "Enter the override PIN to add a discount"
      : unlockLabel === "Override price"
        ? "Enter the override PIN to change the price"
        : "Enter the override PIN to adjust price or add a discount";

  return (
    <div className="space-y-5">
      <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
        {item.optionGroups.map((group) => {
          const selected = selection[group.id] ?? [];
          const single = group.maxSelect === 1;
          const atCap = !single && selected.length >= group.maxSelect;
          return (
            <div key={group.id}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <Label className="mb-0">{group.name}</Label>
                <span className="text-xs font-medium text-slate-400">
                  {group.required ? "Required" : "Optional"}
                  {!single && ` · up to ${group.maxSelect}`}
                </span>
              </div>
              <div className="space-y-2">
                {group.choices.map((choice) => {
                  const isSelected = selected.includes(choice.id);
                  const disabled = !single && !isSelected && atCap;
                  return (
                    <Button
                      key={choice.id}
                      type="button"
                      variant="ghost"
                      disabled={disabled}
                      onClick={() => choose(group.id, choice.id)}
                      className={cn(
                        "h-auto whitespace-normal hover:bg-transparent",
                        "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                        isSelected
                          ? "border-accent-500 bg-accent-50"
                          : "border-slate-200 bg-white hover:bg-slate-50",
                        disabled && "cursor-not-allowed opacity-50"
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center border-2",
                            single ? "rounded-full" : "rounded",
                            isSelected
                              ? "border-accent-600 bg-accent-600 text-white"
                              : "border-slate-300"
                          )}
                          aria-hidden="true"
                        >
                          {isSelected && (
                            <span
                              className={cn(
                                single
                                  ? "h-2 w-2 rounded-full bg-white"
                                  : "text-xs font-bold leading-none"
                              )}
                            >
                              {single ? "" : "✓"}
                            </span>
                          )}
                        </span>
                        <span className="text-base font-medium text-slate-800">
                          {choice.name}
                        </span>
                      </span>
                      {choice.priceDelta !== 0 && (
                        <span className="text-sm font-semibold text-slate-500">
                          +{formatPrice(choice.priceDelta)}
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Dine-in / Takeaway */}
        <div>
          <Label className="mb-2">Serving</Label>
          <div className="flex gap-2">
            <ServeToggle
              active={!takeaway}
              onClick={() => setTakeaway(false)}
              icon={<Utensils className="h-4 w-4" />}
              label="Dine-in"
            />
            <ServeToggle
              active={takeaway}
              onClick={() => setTakeaway(true)}
              icon={<ShoppingBag className="h-4 w-4" />}
              label="Takeaway"
            />
          </div>
          {takeaway && takeawayCharge > 0 && (
            <Label className="mt-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <Checkbox
                checked={applyCharge}
                onCheckedChange={(c) => setApplyCharge(c === true)}
                className="h-4 w-4"
              />
              Add packaging charge (+{formatPrice(takeawayCharge)} / item)
            </Label>
          )}
        </div>

        {/* Manager adjustments — price override (always PIN) + line discount
            (PIN only when the store requires it). One PIN unlocks both. */}
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <Label className="mb-0">Price</Label>
            {showUnlock && !pwOpen && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPwOpen(true)}
                className="h-auto p-0 hover:bg-transparent inline-flex items-center gap-1 text-sm font-semibold text-accent-700 hover:text-accent-800"
              >
                <Lock className="h-3.5 w-3.5" />
                {unlockLabel}
              </Button>
            )}
          </div>

          {pwOpen && showUnlock && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800">{unlockHint}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input
                  type="password"
                  inputMode="numeric"
                  value={pwValue}
                  autoFocus
                  onChange={(e) =>
                    setPwValue(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  onKeyDown={(e) => e.key === "Enter" && unlock()}
                  placeholder="Override PIN"
                  className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
                />
                <Button size="sm" onClick={unlock} disabled={pwBusy || !pwValue}>
                  {pwBusy ? "Checking…" : "Unlock"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPwOpen(false);
                    setPwValue("");
                    setPwError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
              {pwError && (
                <p className="mt-1 text-xs font-semibold text-red-600">{pwError}</p>
              )}
            </div>
          )}

          {/* Price / override — the override INPUT is revealed only by the PIN
              (when required), never by editing a discounted line. */}
          {overrideReady ? (
            overridden ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-500">RM</span>
                <Input
                  type="number"
                  min="0"
                  step="0.10"
                  value={overridePrice}
                  onChange={(e) => setOverridePrice(e.target.value)}
                  className="h-10 w-28 rounded-lg border border-amber-300 bg-amber-50 px-3 text-base font-bold text-slate-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={clearOverride}
                  className="h-auto p-0 hover:bg-transparent text-xs font-semibold text-slate-500 underline hover:text-slate-700"
                >
                  Use menu price ({formatPrice(basePrice)})
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-500">{formatPrice(basePrice)} each</p>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setOverridden(true);
                    setOverridePrice(basePrice.toFixed(2));
                  }}
                  className="h-auto p-0 hover:bg-transparent text-sm font-semibold text-accent-700 hover:text-accent-800"
                >
                  Override price
                </Button>
              </div>
            )
          ) : (
            !pwOpen && (
              <p className="text-sm text-slate-500">{formatPrice(basePrice)} each</p>
            )
          )}

          {/* Line discount — inline when no PIN required, else behind the PIN */}
          {(discountPinRequired ? discountUnlocked : true) && (
            <div className="mt-3">{discountFields}</div>
          )}
        </div>

        <div>
          <Label htmlFor="picker-note">Remarks (optional)</Label>
          <Textarea
            id="picker-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. no spring onion, less spicy"
            className="min-h-[64px]"
          />
        </div>

        {/* Custom add-ons / special requests — ad-hoc extras with a price
            (e.g. "add 2 eggs" +RM2). Each adds to the line price + prints. */}
        <div>
          <Label className="mb-2">Add-ons / special requests</Label>
          {addons.length > 0 && (
            <div className="space-y-2">
              {addons.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={a.name}
                    onChange={(e) => updateAddon(i, { name: e.target.value })}
                    placeholder="e.g. Add 2 eggs, extra vegetables"
                    maxLength={120}
                    className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-slate-500">RM</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.10"
                      value={a.price}
                      onChange={(e) => updateAddon(i, { price: e.target.value })}
                      placeholder="0.00"
                      aria-label="Add-on price"
                      className="h-10 w-20 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAddon(i)}
                    aria-label={`Remove add-on ${i + 1}`}
                    className="h-auto w-auto shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={addAddon}
            className="h-auto mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-accent-300 hover:text-accent-700"
          >
            <Plus className="h-4 w-4" />
            Add add-on
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Quantity
          </p>
          <QtyStepper value={quantity} onChange={setQuantity} />
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Line total
          </p>
          {useDiscount && (
            <p className="text-xs font-medium text-slate-400 line-through">
              {formatPrice(lineGross)}
            </p>
          )}
          <p className="text-2xl font-black text-slate-900">
            {formatPrice(lineTotal)}
          </p>
        </div>
      </div>

      {!valid && (
        <p className="text-sm font-medium text-amber-600">
          Please choose the required options.
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!valid}>
          {editing ? "Save changes" : "Add to order"}
        </Button>
      </div>
    </div>
  );
}

function ServeToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className={cn(
        "h-auto inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-base font-semibold transition-colors",
        active
          ? "border-accent-500 bg-accent-50 text-accent-700"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      )}
    >
      {icon}
      {label}
    </Button>
  );
}
