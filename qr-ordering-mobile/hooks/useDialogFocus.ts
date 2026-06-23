"use client";

import { useEffect, type RefObject } from "react";

// Elements that can receive keyboard focus inside a dialog. Used to find the
// first/last focusable for the Tab trap and to move focus into the sheet.
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

/**
 * Focus management for a bottom-sheet dialog (ItemModal / ComboModal).
 *
 * When `active` flips true: remembers what was focused, then moves focus into
 * the sheet — preferring the element matching `initialFocusSelector` (the Close
 * button), falling back to the first focusable, then the sheet container itself
 * (which must carry `tabIndex={-1}`). While active, Tab / Shift+Tab are trapped
 * inside the sheet and wrap first<->last. When `active` flips false, focus is
 * restored to the previously-focused element.
 *
 * This does NOT handle Escape-to-close — the modals keep their own handler.
 */
export function useDialogFocus(
  active: boolean,
  sheetRef: RefObject<HTMLElement | null>,
  initialFocusSelector?: string,
) {
  useEffect(() => {
    if (!active) return;
    const sheet = sheetRef.current;
    if (!sheet) return;

    // (a) Save whatever had focus so we can restore it on close.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // (b) Move focus into the sheet once it's shown.
    const focusInitial = () => {
      const preferred = initialFocusSelector
        ? sheet.querySelector<HTMLElement>(initialFocusSelector)
        : null;
      if (preferred) {
        preferred.focus();
        return;
      }
      const focusables = getFocusable(sheet);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        sheet.focus();
      }
    };
    // Defer one frame so the slide-up has mounted/painted before we focus.
    const raf = requestAnimationFrame(focusInitial);

    // Trap Tab / Shift+Tab within the sheet, wrapping first<->last.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = getFocusable(sheet);
      if (focusables.length === 0) {
        e.preventDefault();
        sheet.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement;

      if (e.shiftKey) {
        if (activeEl === first || !sheet.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !sheet.contains(activeEl)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      // Restore focus to whatever was focused before the dialog opened.
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [active, sheetRef, initialFocusSelector]);
}
