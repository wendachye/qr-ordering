"use client";

import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChargeBreakdown } from "@/components/orders/ChargeBreakdown";
import { settingsApi } from "@/lib/endpoints";
import { customerReceiptLink } from "@/lib/customer";
import { cn } from "@/lib/utils";
import { formatDateTime, formatPrice, formatTime } from "@/lib/format";
import type { SessionDetail, SessionStatus } from "@/lib/types";

const SESSION_TONE: Record<SessionStatus, "accent" | "green" | "gray"> = {
  OPEN: "accent",
  CLOSED: "green",
  CANCELLED: "gray",
  MERGED: "gray",
};

/* ----- Closed / cancelled tab: read-only summary ----- */
export function ClosedSessionView({ session }: { session: SessionDetail }) {
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black text-slate-900">
                {session.table.name}
              </h1>
              <p className="mt-1 font-mono text-sm text-slate-400">
                {session.table.code} · Session #{session.sessionNumber}
              </p>
              <p className="mt-1 text-slate-500">
                Closed {formatDateTime(session.closedAt ?? session.openedAt)}
                {session.paymentMethod ? ` · Paid by ${session.paymentMethod}` : ""}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge tone={SESSION_TONE[session.status]}>{session.status}</Badge>
              {session.status === "CLOSED" && (
                <a
                  href={customerReceiptLink(session.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Receipt className="h-4 w-4" />
                  Receipt
                </a>
              )}
            </div>
          </div>
          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">
                {session.roundCount} {session.roundCount === 1 ? "round" : "rounds"} ·{" "}
                {session.totalItems} {session.totalItems === 1 ? "item" : "items"}
                {session.pax ? ` · ${session.pax} pax` : ""}
              </span>
              <span
                className={cn(
                  "font-black text-slate-900",
                  session.discount > 0 ? "text-lg font-semibold text-slate-500" : "text-2xl"
                )}
              >
                {formatPrice(session.total)}
              </span>
            </div>
            {session.discount > 0 && (
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center justify-between text-emerald-700">
                  <span className="text-sm font-semibold">
                    Discount
                    {session.discountType === "PERCENT"
                      ? ` (${session.discountValue}%)`
                      : ""}
                  </span>
                  <span className="text-sm font-bold">
                    −{formatPrice(session.discount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Net total</span>
                  <span className="text-2xl font-black text-slate-900">
                    {formatPrice(session.netTotal)}
                  </span>
                </div>
              </div>
            )}
            <ChargeBreakdown total={session.netTotal} settings={settingsQuery.data} />
            {session.tipTotal > 0 && (
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-sm font-semibold">Tip</span>
                  <span className="text-sm font-bold">+{formatPrice(session.tipTotal)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                  <span className="font-semibold text-slate-600">Total collected</span>
                  <span className="text-2xl font-black text-slate-900">
                    {formatPrice(Math.round((session.netTotal + session.tipTotal) * 100) / 100)}
                  </span>
                </div>
              </div>
            )}
            {session.payments.filter((p) => !p.voided).length > 0 && (
              <div className="mt-3 border-t border-slate-200 pt-3">
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Tender</p>
                <ul className="space-y-1">
                  {session.payments
                    .filter((p) => !p.voided)
                    .map((p) => (
                      <li key={p.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">
                          {p.method}
                          {p.tip > 0 ? ` · tip ${formatPrice(p.tip)}` : ""}
                        </span>
                        <span className="font-semibold text-slate-700">
                          {formatPrice(Math.round((p.amount + p.tip) * 100) / 100)}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {session.rounds.map((round) => (
        <Card
          key={round.id}
          className={cn(round.status === "CANCELLED" && "opacity-60")}
        >
          <CardContent>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                {round.roundNumber ? `Round ${round.roundNumber}` : "Round"}
              </h2>
              <span className="text-sm text-slate-400">
                #{round.orderNumber} · {formatTime(round.createdAt)}
              </span>
              {round.status === "CANCELLED" && <Badge tone="gray">Cancelled</Badge>}
            </div>
            <ul className="divide-y divide-slate-100">
              {round.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-4 py-2"
                >
                  <span
                    className={cn(
                      "text-slate-800",
                      item.voided && "text-slate-400 line-through"
                    )}
                  >
                    <span className="font-semibold">{item.quantity}×</span>{" "}
                    {item.name}
                    {item.selectedOptions.length > 0 && (
                      <span className="text-slate-400">
                        {" · "}
                        {item.selectedOptions.map((o) => o.choice).join(", ")}
                      </span>
                    )}
                    {item.discountAmount > 0 && (
                      <span className="ml-1 rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                        {item.discountType === "PERCENT"
                          ? `${item.discountValue}%`
                          : `−${formatPrice(item.discountAmount)}`}
                      </span>
                    )}
                  </span>
                  {item.voided ? (
                    <span className="shrink-0 text-xs font-bold uppercase text-red-400">
                      Void
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1.5">
                      {item.discountAmount > 0 && (
                        <span className="text-xs text-slate-400 line-through">
                          {formatPrice(item.totalPrice + item.discountAmount)}
                        </span>
                      )}
                      <span className="font-semibold text-slate-700">
                        {formatPrice(item.totalPrice)}
                      </span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
