"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { MenuItem, OptionChoice, OptionGroup } from "@/lib/types";
import { formatPrice } from "@/lib/currency";
import { Button } from "@/components/common/Button";
import { QuantityStepper } from "@/components/common/QuantityStepper";
import { ImageCarousel } from "@/components/menu/ImageCarousel";
import { tagChipClasses } from "@/lib/tags";
import { useDialogFocus } from "@/hooks/useDialogFocus";

// What the modal hands back to MenuView when "Add to cart" is pressed.
export type AddSelection = {
  quantity: number;
  note: string;
  // Effective unit price = base + sum of selected deltas.
  unitPrice: number;
  options: { group: string; choice: string; priceDelta: number }[];
  optionChoiceIds: string[];
};

// Pre-select the first choice of every required single-select group so the
// item is orderable by default; leave everything else unselected.
function initialSelection(item: MenuItem): Record<string, string[]> {
  const sel: Record<string, string[]> = {};
  for (const g of item.optionGroups) {
    if (g.required && g.maxSelect === 1 && g.choices.length > 0) {
      sel[g.id] = [g.choices[0].id];
    } else {
      sel[g.id] = [];
    }
  }
  return sel;
}

const ANIM_MS = 300;

/**
 * Bottom-sheet modal for adding a single menu item to the cart. Slides up from
 * the bottom on open and slides back down on close (`shownItem` keeps the
 * content mounted through the closing animation). Lets the customer pick
 * options, a quantity and an optional per-item note.
 */
export function ItemModal({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItem | null;
  onClose: () => void;
  onAdd: (item: MenuItem, selection: AddSelection) => void;
}) {
  // `shownItem` lags `item` so we can animate the close before unmounting.
  const [shownItem, setShownItem] = useState<MenuItem | null>(null);
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  // groupId -> selected choice ids
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  // Drag-to-dismiss: grab the top handle and pull the sheet down to close.
  // `dragY` is the live downward offset (px); `dragging` disables the CSS
  // transition so the sheet tracks the finger 1:1.
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startY: number; lastY: number; lastT: number; vy: number; height: number } | null>(null);

  // Open → mount + reset + slide up (next frame). Close → slide down, then unmount.
  useEffect(() => {
    if (item) {
      setShownItem(item);
      setQuantity(1);
      setNote("");
      setSelected(initialSelection(item));
      setDragY(0);
      // Let the closed (translate-y-full) state commit/paint, then slide up.
      // A timer is more reliable than rAF, which can be throttled when the page
      // isn't actively painting.
      const raise = setTimeout(() => setOpen(true), 20);
      return () => clearTimeout(raise);
    }
    setOpen(false);
    const t = setTimeout(() => setShownItem(null), ANIM_MS);
    return () => clearTimeout(t);
  }, [item]);

  // Close on Escape.
  useEffect(() => {
    if (!shownItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shownItem, onClose]);

  // Focus management: trap focus in the sheet while open, restore on close.
  // Initial focus goes to the Close button (data-dialog-initial-focus).
  useDialogFocus(Boolean(shownItem), sheetRef, "[data-dialog-initial-focus]");

  // First required group still missing its minimum — drives the Add button.
  const missingGroup = useMemo<OptionGroup | null>(() => {
    if (!shownItem) return null;
    for (const g of shownItem.optionGroups) {
      if (g.required && (selected[g.id]?.length ?? 0) < g.minSelect) return g;
    }
    return null;
  }, [shownItem, selected]);

  // Effective unit price = base + sum of selected deltas.
  const unitPrice = useMemo(() => {
    if (!shownItem) return 0;
    let sum = shownItem.salePrice ?? shownItem.price;
    for (const g of shownItem.optionGroups) {
      const chosen = selected[g.id] ?? [];
      for (const c of g.choices) {
        if (chosen.includes(c.id)) sum += c.priceDelta;
      }
    }
    return sum;
  }, [shownItem, selected]);

  if (!shownItem) return null;
  const activeItem = shownItem;

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
    // Close on a long pull (≥30% of the sheet, capped) or a quick downward flick;
    // otherwise snap back. On close we keep `dragY` so the sheet continues sliding
    // down into the close animation instead of jumping back up first. The flick
    // only counts if the finger was still moving at release (ignore stale velocity
    // from a drag that paused before lifting).
    const closeThreshold = Math.min(160, s.height * 0.3);
    const flickedDown = e.timeStamp - s.lastT < 100 && s.vy > 0.6 && dy > 40;
    if (dy > closeThreshold || flickedDown) {
      onClose();
    } else {
      setDragY(0);
    }
  };

  const toggleChoice = (group: OptionGroup, choice: OptionChoice) => {
    setSelected((prev) => {
      const current = prev[group.id] ?? [];
      if (group.maxSelect === 1) {
        // Single-select: replace.
        return { ...prev, [group.id]: [choice.id] };
      }
      // Multi-select: toggle, capped at maxSelect.
      if (current.includes(choice.id)) {
        return { ...prev, [group.id]: current.filter((id) => id !== choice.id) };
      }
      if (current.length >= group.maxSelect) return prev;
      return { ...prev, [group.id]: [...current, choice.id] };
    });
  };

  const handleAdd = () => {
    if (missingGroup) return;
    const options: AddSelection["options"] = [];
    const optionChoiceIds: string[] = [];
    for (const g of activeItem.optionGroups) {
      const chosen = selected[g.id] ?? [];
      for (const c of g.choices) {
        if (chosen.includes(c.id)) {
          options.push({ group: g.name, choice: c.name, priceDelta: c.priceDelta });
          optionChoiceIds.push(c.id);
        }
      }
    }
    onAdd(activeItem, { quantity, note, unitPrice, options, optionChoiceIds });
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
      aria-label={activeItem.name}
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
        tabIndex={-1}
        className="relative z-10 max-h-[90vh] w-full max-w-app overflow-y-auto rounded-t-3xl bg-white p-5 pb-6 shadow-xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform focus:outline-none"
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

        {/* Close button — top-right, sits above the drag handle row */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          data-dialog-initial-focus
          className="absolute right-3 top-2 flex h-11 w-11 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {activeItem.imageUrls.length > 0 && (
          <div className="mb-4">
            <ImageCarousel images={activeItem.imageUrls} alt={activeItem.name} />
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold text-black">{activeItem.name}</h2>
          {activeItem.salePrice != null && activeItem.salePrice < activeItem.price ? (
            <p className="shrink-0 text-right text-lg font-bold">
              <span className="text-red-600">{formatPrice(activeItem.salePrice)}</span>{" "}
              <span className="text-sm font-medium text-gray-400 line-through">
                {formatPrice(activeItem.price)}
              </span>
            </p>
          ) : (
            <p className="shrink-0 text-lg font-bold text-black">
              {formatPrice(activeItem.price)}
            </p>
          )}
        </div>

        {activeItem.description && (
          <p className="mt-2 text-sm text-gray-600">{activeItem.description}</p>
        )}

        {activeItem.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {activeItem.tags.map((t) => (
              <span
                key={t}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tagChipClasses(t)}`}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Option groups */}
        {activeItem.optionGroups.map((group) => {
          const chosen = selected[group.id] ?? [];
          const multi = group.maxSelect > 1;
          const maxReached = multi && chosen.length >= group.maxSelect;
          const headingId = `item-group-${group.id}`;
          return (
            <div key={group.id} className="mt-5">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 id={headingId} className="text-sm font-semibold text-black">
                  {group.name}
                </h3>
                <span className="text-xs text-gray-400">
                  {group.required ? "Required" : "Optional"}
                  {multi ? ` · Choose up to ${group.maxSelect}` : ""}
                </span>
              </div>
              <div
                className="flex flex-col gap-2"
                role={multi ? "group" : "radiogroup"}
                aria-labelledby={headingId}
                // aria-required is only valid on radiogroup, not role=group.
                aria-required={multi ? undefined : group.required}
              >
                {group.choices.map((choice) => {
                  const isSelected = chosen.includes(choice.id);
                  const disabled = !isSelected && maxReached;
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      role={multi ? "checkbox" : "radio"}
                      onClick={() => toggleChoice(group, choice)}
                      disabled={disabled}
                      aria-checked={isSelected}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                        isSelected
                          ? "border-accent bg-accent/5 text-black"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50"
                      } ${disabled ? "opacity-40" : ""}`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center border ${
                            multi ? "rounded-md" : "rounded-full"
                          } ${
                            isSelected
                              ? "border-accent bg-accent text-accent-fg"
                              : "border-gray-300"
                          }`}
                          aria-hidden="true"
                        >
                          {isSelected && (
                            <span
                              className={
                                multi
                                  ? "text-xs font-bold leading-none"
                                  : "h-2 w-2 rounded-full bg-accent-fg"
                              }
                            >
                              {multi ? "✓" : ""}
                            </span>
                          )}
                        </span>
                        <span className="font-medium">{choice.name}</span>
                      </span>
                      {choice.priceDelta > 0 && (
                        <span className="shrink-0 text-xs font-medium text-gray-500">
                          +{formatPrice(choice.priceDelta)}
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
            htmlFor="item-note"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Note (optional)
          </label>
          <textarea
            id="item-note"
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
