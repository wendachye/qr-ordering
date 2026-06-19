"use client";

import { useEffect, useRef } from "react";
import type { MenuCategory } from "@/lib/types";

/**
 * Horizontal, scrollable category selector (thumbnail + label). Selecting a
 * category filters the items grid below; the active category is shown in the
 * accent color. No images in the MVP, so we use a soft initial-letter avatar.
 *
 * Scrolling:
 * - Touch devices: native horizontal scroll (overflow-x-auto). Tap selects.
 * - Desktop: click-and-drag to scroll (pointer events, mouse only). A drag of
 *   more than ~5px is treated as a scroll, not a tap, so it doesn't fire the
 *   category's onClick.
 */
export function CategoryTabs({
  categories,
  activeId,
  onSelect,
}: {
  categories: MenuCategory[];
  activeId: string | null;
  onSelect: (categoryId: string) => void;
}) {
  const navRef = useRef<HTMLElement>(null);
  const drag = useRef({ startX: 0, startScroll: 0, active: false, moved: false });

  // Let a vertical mouse wheel scroll the bar horizontally (desktop). Uses a
  // native non-passive listener so preventDefault works — React's onWheel is
  // attached passively and cannot preventDefault.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return; // nothing to scroll
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  if (categories.length === 0) return null;

  // Mouse drag-to-scroll. Touch is left to the browser's native scroll.
  const onPointerDown = (e: React.PointerEvent) => {
    // Reset the tap/drag discriminator for EVERY pointer (incl. touch taps).
    drag.current.moved = false;
    if (e.pointerType !== "mouse") return;
    const el = navRef.current;
    if (!el) return;
    drag.current.startX = e.clientX;
    drag.current.startScroll = el.scrollLeft;
    drag.current.active = true;
    // NOTE: intentionally NOT calling setPointerCapture here. Capturing the
    // pointer on the <nav> makes the browser dispatch the following click to
    // the nav instead of the category <button>, so tapping a category did
    // nothing. Without capture, clicks work and the drag still scrolls.
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const el = navRef.current;
    if (!el) return;
    const dx = e.clientX - drag.current.startX;
    // Past ~5px we consider this a drag, not a tap.
    if (Math.abs(dx) > 5) drag.current.moved = true;
    el.scrollLeft = drag.current.startScroll - dx;
  };

  const endDrag = () => {
    drag.current.active = false;
  };

  return (
    <nav
      ref={navRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
      className="flex cursor-grab gap-4 overflow-x-auto px-4 py-3 active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {categories.map((c) => {
        const active = c.id === activeId;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              // Suppress the click that ends a drag so dragging doesn't switch
              // categories. Taps (no movement) still select normally.
              if (drag.current.moved) return;
              onSelect(c.id);
            }}
            aria-pressed={active}
            className="flex w-16 shrink-0 flex-col items-center gap-1.5"
          >
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold transition ${
                active
                  ? "bg-accent/10 text-accent ring-2 ring-accent"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {c.name.charAt(0).toUpperCase()}
            </span>
            <span
              className={`w-full truncate text-center text-xs font-medium ${
                active ? "text-accent" : "text-gray-600"
              }`}
            >
              {c.name}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
