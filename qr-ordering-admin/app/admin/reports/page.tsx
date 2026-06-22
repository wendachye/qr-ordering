"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Lock,
  Printer,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { reportsApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SalesReport } from "@/lib/types";
import { useEntitlements } from "@/hooks/useEntitlements";
import { UpgradeNotice } from "@/components/common/UpgradeNotice";
import { ReportView } from "@/components/reports/ReportView";

// ---- date helpers (local business day, venue timezone) ----
function ymd(y: number, mZero: number, d: number): string {
  return `${y}-${String(mZero + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function todayStr(): string {
  const d = new Date();
  return ymd(d.getFullYear(), d.getMonth(), d.getDate());
}
function monthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function shiftDay(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const nd = new Date(y, m - 1, d + delta);
  return ymd(nd.getFullYear(), nd.getMonth(), nd.getDate());
}
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const nd = new Date(y, m - 1 + delta, 1);
  return `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}`;
}
type Mode = "day" | "month" | "range";

export default function ReportsPage() {
  const [mode, setMode] = useState<Mode>("day");
  const [day, setDay] = useState<string>(todayStr);
  const [month, setMonth] = useState<string>(monthStr);
  const [from, setFrom] = useState<string>(() => shiftDay(todayStr(), -6));
  const [to, setTo] = useState<string>(todayStr);

  // "Advanced reports" (month + custom range) is a Pro feature; Basic keeps the
  // single-day Z reading. The backend enforces this too (multi-day → 403).
  const { locked } = useEntitlements();
  const advLocked = locked("reports_advanced");

  const range = useMemo(() => {
    const t = todayStr();
    if (mode === "day") return { from: day, to: day };
    if (mode === "month") {
      const [y, m] = month.split("-").map(Number);
      const last = new Date(y, m, 0).getDate();
      let toD = `${month}-${String(last).padStart(2, "0")}`;
      if (toD > t) toD = t; // don't report the future
      return { from: `${month}-01`, to: toD };
    }
    // range — guard inverted input
    return from <= to ? { from, to } : { from: to, to: from };
  }, [mode, day, month, from, to]);

  const query = useQuery({
    queryKey: ["sales-report", range.from, range.to],
    queryFn: () => reportsApi.sales(range.from, range.to),
  });

  const isTodayDay = day === todayStr();
  const isThisMonth = month === monthStr();

  return (
    <>
      {/* Period selector + export/print */}
      <div className="mb-5 flex flex-wrap items-center gap-3 print:hidden">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {(["day", "month", "range"] as Mode[]).map((m) => {
            const lockedMode = advLocked && m !== "day";
            return (
              <button
                key={m}
                type="button"
                onClick={() => !lockedMode && setMode(m)}
                disabled={lockedMode}
                title={lockedMode ? "Upgrade to Pro for monthly & custom-range reports" : undefined}
                className={cn(
                  "flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold capitalize transition-colors",
                  mode === m ? "bg-accent-600 text-white" : "text-slate-600 hover:bg-slate-100",
                  lockedMode && "cursor-not-allowed opacity-50 hover:bg-transparent"
                )}
              >
                {m}
                {lockedMode && <Lock className="h-3 w-3" />}
              </button>
            );
          })}
        </div>

        {mode === "day" && (
          <div className="flex items-center gap-2">
            <DatePicker
              size="xs"
              value={new Date(`${day}T00:00:00`)}
              max={new Date()}
              onChange={(d) => setDay(format(d, "yyyy-MM-dd"))}
            />
            {!isTodayDay && (
              <Button variant="secondary" size="xs" onClick={() => setDay(todayStr())}>
                Today
              </Button>
            )}
          </div>
        )}

        {mode === "month" && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
              <Button variant="ghost" size="icon" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month">
                <ChevronLeft />
              </Button>
              <input
                type="month"
                value={month}
                max={monthStr()}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
                className="bg-transparent px-1 text-sm font-semibold text-slate-700 focus:outline-none"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMonth((m) => shiftMonth(m, 1))}
                disabled={isThisMonth}
                aria-label="Next month"
              >
                <ChevronRight />
              </Button>
            </div>
            {!isThisMonth && (
              <Button variant="secondary" size="xs" onClick={() => setMonth(monthStr())}>
                This month
              </Button>
            )}
          </div>
        )}

        {mode === "range" && (
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker
              size="xs"
              value={new Date(`${from}T00:00:00`)}
              max={new Date(`${to}T00:00:00`)}
              onChange={(d) => setFrom(format(d, "yyyy-MM-dd"))}
            />
            <span className="text-slate-400">→</span>
            <DatePicker
              size="xs"
              value={new Date(`${to}T00:00:00`)}
              min={new Date(`${from}T00:00:00`)}
              max={new Date()}
              onChange={(d) => setTo(format(d, "yyyy-MM-dd"))}
            />
            <Button variant="secondary" size="xs" onClick={() => { setTo(todayStr()); setFrom(shiftDay(todayStr(), -6)); }}>
              7 days
            </Button>
            <Button variant="secondary" size="xs" onClick={() => { setTo(todayStr()); setFrom(shiftDay(todayStr(), -29)); }}>
              30 days
            </Button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="secondary"
            size="xs"
            onClick={() => query.data && downloadCsv(query.data)}
            disabled={!query.data}
          >
            <Download />
            CSV
          </Button>
          <Button size="xs" onClick={() => window.print()} disabled={!query.data}>
            <Printer />
            Print
          </Button>
        </div>
      </div>

      {advLocked && (
        <UpgradeNotice
          className="mb-5 print:hidden"
          title="Monthly & custom-range reports are a Pro feature"
        >
          Basic includes today&apos;s Z reading. Upgrade for month and custom date-range analytics.
        </UpgradeNotice>
      )}

      {query.isLoading ? (
        <LoadingState label="Loading report…" />
      ) : query.isError ? (
        <ErrorState
          message={query.error instanceof ApiError ? query.error.message : "Could not load the report."}
          onRetry={() => query.refetch()}
        />
      ) : query.data ? (
        <ReportView report={query.data} />
      ) : null}
    </>
  );
}

// ---------------- CSV export ----------------

function toCsv(report: SalesReport): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const L: string[] = [];
  L.push(`Sales report,${report.period.from} to ${report.period.to}`);
  L.push(`Store,${esc(report.storeName)}`);
  L.push("");
  L.push("Summary,Amount");
  L.push(`Gross sales,${report.sales.grossSales}`);
  L.push(`Item discounts,${report.sales.itemDiscounts}`);
  L.push(`Bill discounts,${report.sales.billDiscounts}`);
  L.push(`Voucher discounts,${report.sales.voucherDiscounts}`);
  L.push(`Net sales,${report.sales.netSales}`);
  if (report.charges.serviceChargeRate > 0 || report.sales.taxes.length > 0) {
    L.push(`Subtotal (ex. charges),${report.sales.subtotalExCharges}`);
    if (report.charges.serviceChargeRate > 0) {
      L.push(`Service charge ${report.charges.serviceChargeRate}%,${report.sales.serviceCharge}`);
    }
    report.sales.taxes.forEach((t) => L.push(`${t.name} ${t.rate}%,${t.amount}`));
    L.push(`Total collected,${report.sales.totalCollected}`);
  }
  L.push("");
  L.push("Payment method,Tabs,Amount,%");
  report.byPayment.forEach((p) => L.push(`${esc(p.method)},${p.tabs},${p.amount},${p.pct}`));
  L.push("");
  L.push("Category,Qty,Revenue,%");
  report.byCategory.forEach((c) => L.push(`${esc(c.category)},${c.quantity},${c.revenue},${c.pct}`));
  L.push("");
  L.push("Item,Qty,Revenue");
  report.items.forEach((i) => L.push(`${esc(i.name)},${i.quantity},${i.revenue}`));
  L.push("");
  L.push("Daypart,Tabs,Covers,Revenue,%");
  report.dayparts.forEach((d) => L.push(`${esc(d.label)},${d.tabs},${d.covers},${d.revenue},${d.pct}`));
  if (report.series.length > 1) {
    L.push("");
    L.push("Date,Net sales,Tabs,Covers");
    report.series.forEach((s) => L.push(`${s.date},${s.netSales},${s.tabs},${s.covers}`));
  }
  L.push("");
  L.push("Bill,Table,Pax,Items,Discount,Total");
  report.tabs.forEach((t) =>
    L.push(`${t.sessionNumber},${esc(t.tableName)},${t.pax ?? ""},${t.items},${t.discount},${t.total}`)
  );
  return L.join("\r\n");
}

function downloadCsv(report: SalesReport) {
  const blob = new Blob([toCsv(report)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sales-${report.period.from}_${report.period.to}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
