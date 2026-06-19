"use client";

import { useEffect, useState } from "react";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { customCartLine, type CartLine } from "@/lib/pos";

// Add a custom (open) line to the order — an item that isn't on the menu, e.g.
// "Corkage", an outside birthday cake, a manual charge. Staff type a name + a
// unit price (and optional quantity); the rest of the order flow treats it like
// any other line (it posts with a null menuItemId and buckets under "Custom
// items" in reports).
export function CustomItemDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (line: CartLine) => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState(1);

  // Reset the form whenever the dialog (re)opens.
  useEffect(() => {
    if (open) {
      setName("");
      setPrice("");
      setQty(1);
    }
  }, [open]);

  const priceNum = Number(price);
  const valid =
    name.trim().length > 0 &&
    price.trim() !== "" &&
    Number.isFinite(priceNum) &&
    priceNum >= 0;

  const submit = () => {
    if (!valid) return;
    onConfirm(customCartLine(name, priceNum, qty));
    onClose();
  };

  return (
    <ModalDialog open={open} onClose={onClose} title="Add a custom item">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          For something that isn’t on the menu — corkage, an outside cake, a
          manual charge.
        </p>
        <div>
          <Label htmlFor="custom-name">Name</Label>
          <Input
            id="custom-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Corkage, birthday cake"
            autoFocus
            maxLength={120}
            onKeyDown={(e) => {
              if (e.key === "Enter" && valid) submit();
            }}
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor="custom-price">Unit price (RM)</Label>
            <Input
              id="custom-price"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              onKeyDown={(e) => {
                if (e.key === "Enter" && valid) submit();
              }}
            />
          </div>
          <div className="w-28">
            <Label htmlFor="custom-qty">Qty</Label>
            <Input
              id="custom-qty"
              type="number"
              inputMode="numeric"
              min="1"
              max="99"
              value={qty}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setQty(Number.isFinite(n) ? Math.min(99, Math.max(1, n)) : 1);
              }}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid} onClick={submit}>
            Add to order
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
}
