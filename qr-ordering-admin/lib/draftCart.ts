// Per-table draft cart persistence.
//
// The table workspace lets staff add items to a "New items" cart before sending
// them to the kitchen. Those unsent items are a *draft* — we keep them in
// localStorage keyed by the table's session id so they survive navigating back
// to the Floor (or a page reload) and are only cleared when the round is
// actually sent, or the tab is closed/cancelled.

import type { CartLine } from "./pos";

export interface CartDraft {
  lines: CartLine[];
  note: string;
}

const PREFIX = "qr_admin_draft_";
// Fired (same tab) whenever a draft is written, so the Floor badges can refresh.
export const DRAFT_EVENT = "qr-admin-draft-change";

const keyFor = (sessionId: string) => `${PREFIX}${sessionId}`;
const EMPTY: CartDraft = { lines: [], note: "" };

const isEmptyDraft = (d: CartDraft) =>
  d.lines.length === 0 && d.note.trim() === "";

export function loadDraft(sessionId: string): CartDraft {
  if (typeof window === "undefined" || !sessionId) return { lines: [], note: "" };
  try {
    const raw = window.localStorage.getItem(keyFor(sessionId));
    if (!raw) return { lines: [], note: "" };
    const parsed = JSON.parse(raw) as Partial<CartDraft>;
    return {
      lines: Array.isArray(parsed.lines) ? (parsed.lines as CartLine[]) : [],
      note: typeof parsed.note === "string" ? parsed.note : "",
    };
  } catch {
    return { lines: [], note: "" };
  }
}

export function saveDraft(sessionId: string, draft: CartDraft): void {
  if (typeof window === "undefined" || !sessionId) return;
  try {
    if (isEmptyDraft(draft)) {
      window.localStorage.removeItem(keyFor(sessionId));
    } else {
      window.localStorage.setItem(keyFor(sessionId), JSON.stringify(draft));
    }
    window.dispatchEvent(new CustomEvent(DRAFT_EVENT, { detail: { sessionId } }));
  } catch {
    // Storage can throw (quota / privacy mode) — a lost draft is non-fatal.
  }
}

export function clearDraft(sessionId: string): void {
  saveDraft(sessionId, EMPTY);
}

// Number of unsent units in a table's draft (for the Floor "N unsent" badge).
export function draftCount(sessionId: string): number {
  return loadDraft(sessionId).lines.reduce((n, l) => n + l.quantity, 0);
}
