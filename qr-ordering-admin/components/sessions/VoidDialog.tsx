"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { cn } from "@/lib/utils";
import type { SessionRoundItem } from "@/lib/types";

// Void an item: optional reason (with presets) + the manager PIN when required.
export function VoidDialog({
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
              <Button
                key={r}
                variant="ghost"
                onClick={() => setReason((cur) => (cur === r ? "" : r))}
                className={cn(
                  "h-auto rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  reason === r
                    ? "border-accent-500 bg-accent-50 text-accent-700 hover:bg-accent-50"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                {r}
              </Button>
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
