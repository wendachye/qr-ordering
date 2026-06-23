"use client";

import { useEffect, useState } from "react";
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

// The table's current open tab: every round + item ordered so far this session,
// with a running subtotal. Read-only — the diner reviews; staff settle the bill.
export function TabView({ tableCode }: { tableCode: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [nonce, setNonce] = useState(0);
  const backHref = `/order/${encodeURIComponent(tableCode)}`;

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    getTab(tableCode)
      .then((data) => !cancelled && setState({ status: "ready", data }))
      .catch(
        (err) =>
          !cancelled &&
          setState({
            status: "error",
            message: err instanceof ApiError ? err.message : "We couldn't load your tab.",
          })
      );
    return () => {
      cancelled = true;
    };
  }, [tableCode, nonce]);

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
        <ErrorState message={state.message} onRetry={() => setNonce((n) => n + 1)} />
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
        <h1 className="mt-2 text-xl font-bold text-black">Your tab</h1>
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
