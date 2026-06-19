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
export function useDraftCart(sessionId: string) {
  const init = useRef<{ lines: CartLine[]; note: string } | null>(null);
  if (init.current === null) init.current = loadDraft(sessionId);

  const [cart, setCart] = useState<CartLine[]>(init.current.lines);
  const [note, setNote] = useState<string>(init.current.note);

  // Persist on every change (keyed by session). saveDraft removes the key when
  // the draft is empty, so a cleared cart leaves no orphan.
  useEffect(() => {
    saveDraft(sessionId, { lines: cart, note });
  }, [sessionId, cart, note]);

  const clearDraft = () => {
    setCart([]);
    setNote("");
    clearStoredDraft(sessionId);
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
