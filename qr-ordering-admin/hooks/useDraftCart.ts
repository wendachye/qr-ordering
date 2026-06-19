"use client";

import { useEffect, useRef, useState } from "react";
import type { CartLine } from "@/lib/pos";
import {
  DRAFT_EVENT,
  clearDraft as clearStoredDraft,
  draftCount,
  loadDraft,
  saveDraft,
} from "@/lib/draftCart";

// Cart state for the table workspace, transparently backed by localStorage so a
// table's unsent items persist across navigation/reload until they're sent.
// The component that uses this is gated behind a resolved query (never rendered
// during SSR), so reading storage in a lazy initializer can't cause a
// hydration mismatch.
export function useDraftCart(key: string) {
  const [cart, setCart] = useState<CartLine[]>(() => loadDraft(key).lines);
  const [note, setNote] = useState<string>(() => loadDraft(key).note);

  // When the key changes — switching tables on the New order screen, or a free
  // table becoming a session — load that key's stored draft. Setting state during
  // render is React's "adjust state when a prop changes" pattern: it re-renders
  // before paint, with no flash and no effect race.
  const loadedKey = useRef(key);
  if (loadedKey.current !== key) {
    loadedKey.current = key;
    const d = loadDraft(key);
    setCart(d.lines);
    setNote(d.note);
  }

  // Persist on every change, keyed. saveDraft removes the key when the draft is
  // empty, so a cleared cart leaves no orphan.
  useEffect(() => {
    saveDraft(key, { lines: cart, note });
  }, [key, cart, note]);

  const clearDraft = () => {
    setCart([]);
    setNote("");
    clearStoredDraft(key);
  };

  return { cart, setCart, note, setNote, clearDraft };
}

// Live count of unsent items for a session, for the Floor tile badge. Reads
// after mount (initial 0 matches SSR) and refreshes on draft changes — same tab
// via DRAFT_EVENT, other tabs via the native storage event.
export function useDraftCount(sessionId: string): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(draftCount(sessionId));
    update();
    window.addEventListener(DRAFT_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(DRAFT_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, [sessionId]);

  return count;
}
