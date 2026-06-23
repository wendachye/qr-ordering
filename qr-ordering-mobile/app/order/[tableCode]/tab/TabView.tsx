"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { OpenTab } from "@/lib/types";
import { ApiError, getTab } from "@/lib/api";
import { formatPrice } from "@/lib/currency";
import { MobileShell } from "@/components/layout/MobileShell";
import { Button } from "@/components/common/Button";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: OpenTab };

// Re-check the tab this often while the page is visible — a shared table means a
// companion can add a round from their own phone.
const POLL_MS = 20_000;

// The table's current open tab: every round + item ordered so far this session,
// with a running subtotal. Read-only — the diner reviews; staff settle the bill.
// Auto-refreshes on focus / visibility and on a light poll so a companion's new
// round appears without a manual reload.
export function TabView({ tableCode }: { tableCode: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const backHref = `/order/${encodeURIComponent(tableCode)}`;

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "initial") setState({ status: "loading" });
      else setRefreshing(true);
      try {
        const data = await getTab(tableCode);
        setState({ status: "ready", data });
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "We couldn't load your tab.";
        // On a background refresh keep the data we already have; only fall to the
        // error screen if we never managed an initial load.
        setState((prev) =>
          mode === "initial" || prev.status !== "ready"
            ? { status: "error", message }
            : prev
        );
      } finally {
        if (mode === "refresh") setRefreshing(false);
      }
    },
    [tableCode]
  );

  // Initial load (and again whenever the table changes).
  useEffect(() => {
    load("initial");
  }, [load]);

  // Refresh when the page regains focus / visibility, plus a light poll.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") load("refresh");
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const id = window.setInterval(refresh, POLL_MS);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(id);
    };
  }, [load]);

  if (state.status === "loading") {
    return (
      <MobileShell>
        <LoadingState label="Loading your tab…" />
      </MobileShell>
    );
  }

  if (state.status === "error") {
    return (
      <MobileShell>
        <ErrorState message={state.message} onRetry={() => load("initial")} />
      </MobileShell>
    );
  }

  const tab = state.data;
  const empty = !tab.hasOpenTab || tab.rounds.length === 0;

  return (
    <MobileShell
      footer={
        <div className="p-3">
          <Link href={backHref}>
            <Button size="lg" className="w-full">
              {empty ? "Browse the menu" : "Order more"}
            </Button>
          </Link>
        </div>
      }
    >
      <div className="px-4 pb-1 pt-5">
        <Link href={backHref} className="text-sm text-accent">
          ← Back to menu
        </Link>
        <div className="mt-2 flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-black">Your tab</h1>
          <button
            type="button"
            onClick={() => load("refresh")}
            disabled={refreshing}
            aria-label="Refresh your tab"
            className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium text-accent active:bg-accent/10 disabled:opacity-50"
          >
            <svg
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {tab.tableName}
          {tab.sessionNumber ? ` · Bill #${tab.sessionNumber}` : ""}
        </p>
      </div>

      {empty ? (
        <EmptyState
          title="No orders yet"
          message="Nothing has been ordered on this table yet. Browse the menu to get started."
        />
      ) : (
        <div className="space-y-4 px-4 py-4">
          {tab.rounds.map((round) => (
            <div
              key={round.id}
              className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Round {round.roundNumber}
              </p>
              <ul className="space-y-2">
                {round.items.map((it) => (
                  <li key={it.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-gray-900">
                      <span className="font-medium">{it.quantity}×</span> {it.name}
                      {it.note && (
                        <span className="block text-xs text-gray-400">“{it.note}”</span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums text-gray-700">
                      {formatPrice(it.totalPrice)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
            <span className="text-sm text-gray-500">
              {tab.itemCount} item{tab.itemCount === 1 ? "" : "s"} so far
            </span>
            <span className="text-lg font-bold text-black">{formatPrice(tab.total)}</span>
          </div>
          <p className="px-1 text-center text-xs text-gray-400">
            Taxes, service charge and any discounts appear on the final bill.
          </p>
        </div>
      )}
    </MobileShell>
  );
}
