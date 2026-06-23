"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { PublicCombo, PublicComboGroup, PublicComboOption } from "@/lib/types";
import { formatPrice } from "@/lib/currency";
import { Button } from "@/components/common/Button";
import { QuantityStepper } from "@/components/common/QuantityStepper";
import { ImageCarousel } from "@/components/menu/ImageCarousel";

// What the modal hands back to MenuView when "Add to cart" is pressed.
export type AddComboSelection = {
  quantity: number;
  note: string;
  // Effective unit price = base + sum of selected option deltas.
  unitPrice: number;
  picks: {
    groupId: string;
    groupName: string;
    optionId: string;
    optionName: string;
    priceDelta: number;
  }[];
};

// Pre-select the first AVAILABLE option of every group so the combo is orderable
// by default; fall back to the first option if none are available.
function initialSelection(combo: PublicCombo): Record<string, string> {
  const sel: Record<string, string> = {};
  for (const g of combo.groups) {
    const first = g.options.find((o) => o.isAvailable) ?? g.options[0];
    if (first) sel[g.id] = first.id;
  }
  return sel;
}

const ANIM_MS = 300;

/**
 * Bottom-sheet modal for adding a combo / set meal to the cart. Mirrors
 * ItemModal: slides up on open and back down on close (`shownCombo` keeps the
 * content mounted through the closing animation). The diner picks exactly ONE
 * option per group (radio style) and sees a live running total.
 */
export function ComboModal({
  combo,
  onClose,
  onAdd,
}: {
  combo: PublicCombo | null;
  onClose: () => void;
  onAdd: (combo: PublicCombo, selection: AddComboSelection) => void;
}) {
  // `shownCombo` lags `combo` so we can animate the close before unmounting.
  const [shownCombo, setShownCombo] = useState<PublicCombo | null>(null);
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  // groupId -> selected option id
  const [selected, setSelected] = useState<Record<string, string>>({});

  // Drag-to-dismiss: grab the top handle and pull the sheet down to close.
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startY: number; lastY: number; lastT: number; vy: number; height: number } | null>(null);

  // Open → mount + reset + slide up (next frame). Close → slide down, then unmount.
  useEffect(() => {
    if (combo) {
      setShownCombo(combo);
      setQuantity(1);
      setNote("");
      setSelected(initialSelection(combo));
      setDragY(0);
      const raise = setTimeout(() => setOpen(true), 20);
      return () => clearTimeout(raise);
    }
    setOpen(false);
    const t = setTimeout(() => setShownCombo(null), ANIM_MS);
    return () => clearTimeout(t);
  }, [combo]);

  // Close on Escape.
  useEffect(() => {
    if (!shownCombo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shownCombo, onClose]);

  // First group still missing a pick — drives the Add button. Every group needs
  // exactly one pick; a group with no available option can't be satisfied.
  const missingGroup = useMemo<PublicComboGroup | null>(() => {
    if (!shownCombo) return null;
    for (const g of shownCombo.groups) {
      const chosen = selected[g.id];
      const choice = g.options.find((o) => o.id === chosen);
      if (!choice || !choice.isAvailable) return g;
    }
    return null;
  }, [shownCombo, selected]);

  // Effective unit price = base + sum of selected option deltas.
  const unitPrice = useMemo(() => {
    if (!shownCombo) return 0;
    let sum = shownCombo.price;
    for (const g of shownCombo.groups) {
      const chosen = selected[g.id];
      const choice = g.options.find((o) => o.id === chosen);
      if (choice) sum += choice.priceDelta;
    }
    return sum;
  }, [shownCombo, selected]);

  if (!shownCombo) return null;
  const activeCombo = shownCombo;

  // --- Drag-to-dismiss (attached to the top handle) ---
  const onDragStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = {
      startY: e.clientY,
      lastY: e.clientY,
      lastT: e.timeStamp,
      vy: 0,
      height: sheetRef.current?.offsetHeight ?? 480,
    };
    setDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Some environments reject capture (e.g. synthetic pointers); drag still works.
    }
  };

  const onDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = dragRef.current;
    if (!s) return;
    const dt = Math.max(1, e.timeStamp - s.lastT);
    s.vy = (e.clientY - s.lastY) / dt; // px/ms, positive = downward
    s.lastY = e.clientY;
    s.lastT = e.timeStamp;
    setDragY(Math.max(0, e.clientY - s.startY)); // downward only
  };

  const onDragEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = dragRef.current;
    if (!s) return;
    dragRef.current = null;
    setDragging(false);
    const dy = Math.max(0, e.clientY - s.startY);
    const closeThreshold = Math.min(160, s.height * 0.3);
    const flickedDown = e.timeStamp - s.lastT < 100 && s.vy > 0.6 && dy > 40;
    if (dy > closeThreshold || flickedDown) {
      onClose();
    } else {
      setDragY(0);
    }
  };

  const pickOption = (group: PublicComboGroup, option: PublicComboOption) => {
    if (!option.isAvailable) return;
    setSelected((prev) => ({ ...prev, [group.id]: option.id }));
  };

  const handleAdd = () => {
    if (missingGroup) return;
    const picks: AddComboSelection["picks"] = [];
    for (const g of activeCombo.groups) {
      const chosen = selected[g.id];
      const choice = g.options.find((o) => o.id === chosen);
      if (choice) {
        picks.push({
          groupId: g.id,
          groupName: g.name,
          optionId: choice.id,
          optionName: choice.name,
          priceDelta: choice.priceDelta,
        });
      }
    }
    onAdd(activeCombo, { quantity, note, unitPrice, picks });
  };

  // While dragging, fade the backdrop in proportion to how far the sheet is pulled.
  const backdropStyle = dragging
    ? {
        opacity: Math.max(0, 1 - dragY / (dragRef.current?.height ?? 480)),
        transition: "none" as const,
      }
    : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={activeCombo.name}
    >
      {/* Backdrop (fades in) */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        style={backdropStyle}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet (slides up from the bottom; drag the handle down to dismiss) */}
      <div
        ref={sheetRef}
        className="relative z-10 max-h-[90vh] w-full max-w-app overflow-y-auto rounded-t-3xl bg-white p-5 pb-6 shadow-xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform"
        style={{
          transform: open ? `translateY(${dragY}px)` : "translateY(100%)",
          transition: dragging ? "none" : undefined,
        }}
      >
        {/* Drag handle — grab the top of the sheet and pull down to dismiss */}
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          className="-mx-5 -mt-5 mb-2 cursor-grab touch-none select-none px-5 pb-3 pt-3 active:cursor-grabbing"
          aria-hidden="true"
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-gray-300" />
        </div>

        {activeCombo.imageUrls.length > 0 && (
          <div className="mb-4">
            <ImageCarousel images={activeCombo.imageUrls} alt={activeCombo.name} />
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold text-black">{activeCombo.name}</h2>
          <p className="shrink-0 text-right text-lg font-bold text-black">
            <span className="text-xs font-medium text-gray-400">from </span>
            {formatPrice(activeCombo.price)}
          </p>
        </div>

        {activeCombo.description && (
          <p className="mt-2 text-sm text-gray-600">{activeCombo.description}</p>
        )}

        {/* Choice groups — exactly one pick each (radio style) */}
        {activeCombo.groups.map((group) => {
          const chosen = selected[group.id];
          return (
            <div key={group.id} className="mt-5">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-black">{group.name}</h3>
                <span className="text-xs text-gray-400">Choose 1</span>
              </div>
              <div className="flex flex-col gap-2">
                {group.options.map((option) => {
                  const isSelected = option.id === chosen;
                  const disabled = !option.isAvailable;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => pickOption(group, option)}
                      disabled={disabled}
                      aria-pressed={isSelected}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                        isSelected
                          ? "border-accent bg-accent/5 text-black"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50"
                      } ${disabled ? "opacity-40" : ""}`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            isSelected
                              ? "border-accent bg-accent text-accent-fg"
                              : "border-gray-300"
                          }`}
                          aria-hidden="true"
                        >
                          {isSelected && (
                            <span className="h-2 w-2 rounded-full bg-accent-fg" />
                          )}
                        </span>
                        <span className="font-medium">
                          {option.name}
                          {disabled && (
                            <span className="ml-1.5 text-xs font-normal text-gray-400">
                              Sold out
                            </span>
                          )}
                        </span>
                      </span>
                      {option.priceDelta > 0 && (
                        <span className="shrink-0 text-xs font-medium text-gray-500">
                          +{formatPrice(option.priceDelta)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="mt-5">
          <label
            htmlFor="combo-note"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Note (optional)
          </label>
          <textarea
            id="combo-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="e.g. No cucumber, extra spicy"
            className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Quantity</span>
          <QuantityStepper value={quantity} onChange={setQuantity} />
        </div>

        <Button
          size="lg"
          className="mt-6 w-full"
          disabled={Boolean(missingGroup)}
          onClick={handleAdd}
        >
          {missingGroup
            ? `Choose ${missingGroup.name}`
            : `Add to cart · ${formatPrice(unitPrice * quantity)}`}
        </Button>
      </div>
    </div>
  );
}
