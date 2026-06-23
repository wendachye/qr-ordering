"use client";

import { useMemo, useState } from "react";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { QtyStepper } from "./QtyStepper";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import {
  comboCartLine,
  comboSelectionFromLine,
  comboUnitPrice,
  defaultComboSelection,
  isComboSelectionValid,
  type CartLine,
} from "@/lib/pos";
import type { Combo } from "@/lib/types";

// Picker for a combo / set meal: choose exactly one option per group, then
// quantity + an optional note. Mirrors OptionPicker's dialog but for the fixed
// base-price + one-pick-per-group combo shape. The price shown is an estimate
// (base + selected priceDelta); the server recomputes + charges it on submit.
// When `editing` is passed it seeds from that line and saves back.
export function ComboPicker({
  combo,
  open,
  onClose,
  onAdd,
  editing,
  onSave,
}: {
  combo: Combo | null;
  open: boolean;
  onClose: () => void;
  onAdd: (line: CartLine) => void;
  editing?: CartLine | null;
  onSave?: (line: CartLine) => void;
}) {
  return (
    <ModalDialog open={open && !!combo} onClose={onClose} title={combo?.name}>
      {combo && (
        <ComboPickerBody
          key={editing?.lineId ?? combo.id}
          combo={combo}
          editing={editing ?? null}
          onClose={onClose}
          onSubmit={editing && onSave ? onSave : onAdd}
        />
      )}
    </ModalDialog>
  );
}

function ComboPickerBody({
  combo,
  editing,
  onClose,
  onSubmit,
}: {
  combo: Combo;
  editing: CartLine | null;
  onClose: () => void;
  onSubmit: (line: CartLine) => void;
}) {
  const [selection, setSelection] = useState<Record<string, string>>(() =>
    editing ? comboSelectionFromLine(editing) : defaultComboSelection(combo)
  );
  const [quantity, setQuantity] = useState(editing?.quantity ?? 1);
  const [note, setNote] = useState(editing?.note ?? "");

  const selections = useMemo(
    () =>
      combo.groups
        .filter((g) => selection[g.id])
        .map((g) => ({ groupId: g.id, optionId: selection[g.id] })),
    [combo, selection]
  );
  const unit = useMemo(
    () => comboUnitPrice(combo, selections),
    [combo, selections]
  );
  const valid = useMemo(
    () => isComboSelectionValid(combo, selection),
    [combo, selection]
  );
  const lineTotal = Math.round(unit * quantity * 100) / 100;

  const choose = (groupId: string, optionId: string) =>
    setSelection((prev) => ({ ...prev, [groupId]: optionId }));

  const submit = () => {
    if (!valid) return;
    // Preserve the line id when editing so it updates in place.
    onSubmit(comboCartLine(combo, selection, quantity, note, editing?.lineId));
  };

  return (
    <div className="space-y-5">
      <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
        {combo.description && (
          <p className="text-sm text-slate-500">{combo.description}</p>
        )}

        {combo.groups.map((group) => {
          const chosen = selection[group.id];
          return (
            <div key={group.id}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <Label className="mb-0">{group.name}</Label>
                <span className="text-xs font-medium text-slate-400">
                  Pick 1
                </span>
              </div>
              <div className="space-y-2">
                {group.options.map((opt) => {
                  const isSelected = chosen === opt.id;
                  const disabled = !opt.isAvailable;
                  return (
                    <Button
                      key={opt.id}
                      type="button"
                      variant="ghost"
                      disabled={disabled}
                      onClick={() => choose(group.id, opt.id)}
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
                            "flex h-5 w-5 items-center justify-center rounded-full border-2",
                            isSelected
                              ? "border-accent-600 bg-accent-600 text-white"
                              : "border-slate-300"
                          )}
                          aria-hidden="true"
                        >
                          {isSelected && (
                            <span className="h-2 w-2 rounded-full bg-white" />
                          )}
                        </span>
                        <span className="text-base font-medium text-slate-800">
                          {opt.name}
                          {disabled && (
                            <span className="ml-1.5 text-xs font-semibold text-slate-400">
                              (sold out)
                            </span>
                          )}
                        </span>
                      </span>
                      {opt.priceDelta !== 0 && (
                        <span className="text-sm font-semibold text-slate-500">
                          +{formatPrice(opt.priceDelta)}
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div>
          <Label htmlFor="combo-note">Remarks (optional)</Label>
          <Textarea
            id="combo-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. no spring onion, less spicy"
            className="min-h-[64px]"
          />
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
          <p className="text-2xl font-black text-slate-900">
            {formatPrice(lineTotal)}
          </p>
        </div>
      </div>

      {!valid && (
        <p className="text-sm font-medium text-amber-600">
          Please choose one option for every group.
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
