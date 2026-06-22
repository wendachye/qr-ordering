"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatDateTime, formatPrice, formatTime } from "@/lib/format";
import type { SalesReport } from "@/lib/types";

function prettyDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function prettyMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString([], { month: "long", year: "numeric" });
}

function pctLabel(n: number): string {
  return `${n.toFixed(1)}%`;
}
function duration(min: number): string {
  if (!min || min <= 0) return "—";
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function ReportView({ report }: { report: SalesReport }) {
  const { sales, counts, averages, charges, period } = report;
  const empty = counts.tabsSettled === 0;
  const hasCharges = charges.serviceChargeRate > 0 || sales.taxes.length > 0;
  const hasDiscounts = sales.totalDiscounts > 0;
  const isDay = period.kind === "day";

  const periodTitle = isDay
    ? "Z Reading · Daily Sales"
    : period.kind === "month"
      ? "Monthly Sales"
      : "Sales Report";
  const periodLabel = isDay
    ? prettyDay(period.from)
    : period.kind === "month"
      ? prettyMonth(period.from)
      : `${prettyDay(period.from)} – ${prettyDay(period.to)}`;

  return (
    <div className="mx-auto max-w-5xl print:max-w-full">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
        {/* Receipt-style header */}
        <div className="mb-4 border-b border-dashed border-slate-300 pb-3 text-center">
          <h2 className="text-2xl font-black text-slate-900">{report.storeName}</h2>
          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            {periodTitle}
          </p>
          <p className="mt-1 font-medium text-slate-700">{periodLabel}</p>
          <p className="mt-1 text-xs text-slate-400">
            Generated {formatDateTime(report.generatedAt)}
            {report.audit.firstBillNumber != null && (
              <> · Bills #{report.audit.firstBillNumber}–{report.audit.lastBillNumber}</>
            )}
            {!isDay && <> · {period.days} days</>}
          </p>
        </div>

        {empty ? (
          <p className="py-12 text-center text-slate-500">No tabs were settled in this period.</p>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Kpi label="Net sales" value={formatPrice(sales.netSales)} primary />
              <Kpi label="Gross sales" value={formatPrice(sales.grossSales)} />
              <Kpi label="Tabs" value={String(counts.tabsSettled)} />
              <Kpi label="Covers" value={String(counts.covers)} />
              <Kpi label="Avg / cover" value={counts.covers ? formatPrice(averages.perCover) : "—"} />
              <Kpi label="Avg / tab" value={formatPrice(averages.perTab)} />
              <Kpi label="Items sold" value={String(counts.itemsSold)} />
              {hasDiscounts ? (
                <Kpi label="Discounts" value={`−${formatPrice(sales.totalDiscounts)}`} />
              ) : (
                <Kpi label="Avg / day" value={formatPrice(averages.salesPerDay)} />
              )}
            </div>

            <div className="mt-4 lg:columns-2 lg:gap-x-8 print:columns-1">
              {/* Sales summary / waterfall */}
              <Section title="Sales summary">
                <div className="text-sm">
                  <MoneyLine label="Gross sales" value={formatPrice(sales.grossSales)} />
                  {sales.itemDiscounts > 0 && (
                    <MoneyLine label="Item discounts" value={`−${formatPrice(sales.itemDiscounts)}`} muted />
                  )}
                  {sales.billDiscounts > 0 && (
                    <MoneyLine label="Bill discounts" value={`−${formatPrice(sales.billDiscounts)}`} muted />
                  )}
                  {sales.voucherDiscounts > 0 && (
                    <MoneyLine label="Vouchers" value={`−${formatPrice(sales.voucherDiscounts)}`} muted />
                  )}
                  <MoneyLine label="Net sales" value={formatPrice(sales.netSales)} strong />
                  {sales.tips > 0 && (
                    <>
                      <MoneyLine label="Tips (gratuity)" value={`+${formatPrice(sales.tips)}`} muted />
                      <MoneyLine
                        label="Collected incl. tips"
                        value={formatPrice(sales.grandTotalCollected)}
                        strong
                      />
                    </>
                  )}
                  {hasCharges && (
                    <>
                      <div className="my-2 border-t border-dashed border-slate-200" />
                      <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
                        Tax-inclusive breakdown
                      </p>
                      <MoneyLine label="Subtotal (ex. charges)" value={formatPrice(sales.subtotalExCharges)} />
                      {charges.serviceChargeRate > 0 && (
                        <MoneyLine
                          label={`Service charge (${charges.serviceChargeRate}%)`}
                          value={formatPrice(sales.serviceCharge)}
                        />
                      )}
                      {sales.taxes.map((t) => (
                        <MoneyLine
                          key={t.name}
                          label={`${t.name} (${t.rate}%)`}
                          value={formatPrice(t.amount)}
                        />
                      ))}
                      <MoneyLine label="Total collected" value={formatPrice(sales.totalCollected)} strong />
                    </>
                  )}
                </div>
              </Section>

              {/* Tender */}
              <Section title="Payments (tender)">
                <ReportTable
                  head={["Method", "Tabs", "Amount", "%"]}
                  rows={report.byPayment.map((p) => [
                    p.method,
                    String(p.tabs),
                    formatPrice(p.amount),
                    pctLabel(p.pct),
                  ])}
                  foot={["Total", String(counts.tabsSettled), formatPrice(sales.netSales), "100%"]}
                />
              </Section>

              {/* Category mix */}
              <Section title="Sales by category">
                <BarList
                  rows={report.byCategory.map((c) => ({
                    label: c.category,
                    value: c.revenue,
                    pct: c.pct,
                    sub: `${c.quantity} sold`,
                    right: formatPrice(c.revenue),
                  }))}
                />
              </Section>

              {/* Dayparts */}
              <Section title="Sales by daypart">
                <BarList
                  rows={report.dayparts
                    .filter((d) => d.tabs > 0)
                    .map((d) => ({
                      label: d.label,
                      value: d.revenue,
                      pct: d.pct,
                      sub: `${d.tabs} tabs · ${d.covers} covers`,
                      right: formatPrice(d.revenue),
                    }))}
                  empty="No settlements bucketed yet."
                />
              </Section>

              {/* Channels */}
              <Section title="Dine-in vs takeaway">
                <ChannelSplit
                  dineIn={report.channels.dineIn}
                  takeaway={report.channels.takeaway}
                />
              </Section>

              {/* Top items */}
              <Section title="Top items (by revenue)">
                <ReportTable
                  head={["Item", "Qty", "Revenue"]}
                  rows={report.items
                    .slice(0, 12)
                    .map((i) => [i.name, String(i.quantity), formatPrice(i.revenue)])}
                />
              </Section>
            </div>

            {/* Hourly sales — full width */}
            {report.hourly.some((h) => h.revenue > 0) && (
              <Section title="Hourly sales">
                <HourlyBars hourly={report.hourly} />
              </Section>
            )}

            {/* Per-day trend (ranges) */}
            {report.series.length > 1 && (
              <Section title="Daily trend">
                <TrendBars series={report.series} />
              </Section>
            )}

            {/* Operations + voids/discounts */}
            <div className="mt-2 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
              <StatCard title="Covers & tables">
                <Stat label="Covers (pax)" value={String(counts.covers)} />
                <Stat label="Tables used" value={String(counts.tablesUsed)} />
                <Stat label="Table turns" value={averages.tableTurns ? `${averages.tableTurns.toFixed(1)}×` : "—"} />
                <Stat label="Avg dining time" value={duration(averages.diningMinutes)} />
                <Stat label="Items / tab" value={averages.itemsPerTab ? averages.itemsPerTab.toFixed(1) : "—"} />
              </StatCard>

              <StatCard title="Discounts &amp; vouchers">
                <Stat label="Item discounts" value={formatPrice(sales.itemDiscounts)} />
                <Stat label="Bill discounts" value={formatPrice(sales.billDiscounts)} />
                <Stat
                  label="Vouchers"
                  value={`${report.vouchers.count} · ${formatPrice(sales.voucherDiscounts)}`}
                />
                <Stat label="Total" value={formatPrice(sales.totalDiscounts + sales.voucherDiscounts)} strong />
                <Stat label="% of gross" value={pctLabel(report.discounts.pctOfGross)} />
                <Stat
                  label="Discounted"
                  value={`${report.discounts.discountedItems} items · ${report.discounts.discountedTabs} tabs`}
                />
              </StatCard>

              <StatCard title="Voids & comps">
                <Stat
                  label="Voided items"
                  value={`${report.voids.items.count} · ${formatPrice(report.voids.items.amount)}`}
                />
                <Stat
                  label="Cancelled tabs"
                  value={`${report.voids.tabs.count} · ${formatPrice(report.voids.tabs.amount)}`}
                />
                {report.voids.byReason.length > 0 ? (
                  report.voids.byReason.slice(0, 3).map((r) => (
                    <Stat key={r.reason} label={r.reason} value={`${r.count} · ${formatPrice(r.amount)}`} />
                  ))
                ) : (
                  <Stat label="By reason" value="—" />
                )}
              </StatCard>
            </div>

            {/* Settled tabs ledger */}
            <Section title={`Settled tabs (${report.tabs.length})`}>
              <details open={isDay} className="group">
                <summary className="mb-2 cursor-pointer list-none text-sm font-medium text-accent-700 print:hidden">
                  <span className="group-open:hidden">Show ledger</span>
                  <span className="hidden group-open:inline">Hide ledger</span>
                </summary>
                <div className="max-h-[28rem] overflow-auto print:max-h-none print:overflow-visible">
                  <ReportTable
                    head={
                      hasDiscounts
                        ? ["Bill", "Table", "Time", "Pax", "Items", "Disc", "Total"]
                        : ["Bill", "Table", "Time", "Pax", "Items", "Total"]
                    }
                    rows={report.tabs.map((t) =>
                      hasDiscounts
                        ? [
                            `#${t.sessionNumber}`,
                            t.tableName,
                            t.closedAt ? formatTime(t.closedAt) : "—",
                            t.pax != null ? String(t.pax) : "—",
                            String(t.items),
                            t.discount > 0 ? `−${formatPrice(t.discount)}` : "—",
                            formatPrice(t.total),
                          ]
                        : [
                            `#${t.sessionNumber}`,
                            t.tableName,
                            t.closedAt ? formatTime(t.closedAt) : "—",
                            t.pax != null ? String(t.pax) : "—",
                            String(t.items),
                            formatPrice(t.total),
                          ]
                    )}
                    foot={
                      hasDiscounts
                        ? ["", "", "", "", "", "Net", formatPrice(sales.netSales)]
                        : ["", "", "", "", "Net", formatPrice(sales.netSales)]
                    }
                  />
                </div>
              </details>
            </Section>

            {(report.audit.firstCloseAt || report.audit.lastCloseAt) && (
              <p className="mt-1 text-center text-sm text-slate-500">
                Settlement window: {report.audit.firstCloseAt ? formatTime(report.audit.firstCloseAt) : "—"} –{" "}
                {report.audit.lastCloseAt ? formatTime(report.audit.lastCloseAt) : "—"}
              </p>
            )}

            <p className="mt-4 border-t border-dashed border-slate-300 pt-3 text-center text-xs tracking-widest text-slate-400">
              {isDay ? "*** END OF Z READING ***" : "*** END OF REPORT ***"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------- presentational bits ----------------

function Kpi({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 text-center",
        primary ? "border-accent-200 bg-accent-50" : "border-slate-200 bg-white print:border-slate-300"
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-1 font-black tabular-nums",
          primary ? "text-2xl text-accent-700" : "text-xl text-slate-900"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4 break-inside-avoid">
      <h3 className="mb-1.5 text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

function MoneyLine({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-1",
        strong && "border-t border-slate-200 font-bold text-slate-900",
        muted && "text-slate-500"
      )}
    >
      <span className={cn(!strong && !muted && "text-slate-700")}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function BarList({
  rows,
  empty,
}: {
  rows: { label: string; value: number; pct: number; sub?: string; right: string }[];
  empty?: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-slate-400">{empty ?? "None."}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium text-slate-800">{r.label}</span>
            <span className="tabular-nums text-slate-700">
              {r.right} <span className="text-xs text-slate-400">{pctLabel(r.pct)}</span>
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-accent-500"
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
            />
          </div>
          {r.sub && <p className="mt-0.5 text-xs text-slate-400">{r.sub}</p>}
        </div>
      ))}
    </div>
  );
}

function ChannelSplit({
  dineIn,
  takeaway,
}: {
  dineIn: { items: number; revenue: number };
  takeaway: { items: number; revenue: number; charges: number };
}) {
  const total = dineIn.revenue + takeaway.revenue;
  const dinePct = total ? (dineIn.revenue / total) * 100 : 0;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        <div className="bg-accent-500" style={{ width: `${dinePct}%` }} />
        <div className="bg-amber-400" style={{ width: `${100 - dinePct}%` }} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg border border-slate-200 p-2">
          <p className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="h-2 w-2 rounded-full bg-accent-500" /> Dine-in
          </p>
          <p className="mt-0.5 tabular-nums text-slate-900">{formatPrice(dineIn.revenue)}</p>
          <p className="text-xs text-slate-400">{dineIn.items} items</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-2">
          <p className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Takeaway
          </p>
          <p className="mt-0.5 tabular-nums text-slate-900">{formatPrice(takeaway.revenue)}</p>
          <p className="text-xs text-slate-400">
            {takeaway.items} items
            {takeaway.charges > 0 && <> · {formatPrice(takeaway.charges)} charges</>}
          </p>
        </div>
      </div>
    </div>
  );
}

function HourlyBars({ hourly }: { hourly: SalesReport["hourly"] }) {
  const active = hourly.filter((h) => h.revenue > 0);
  if (active.length === 0) return <p className="text-sm text-slate-400">No sales.</p>;
  const min = Math.min(...active.map((h) => h.hour));
  const max = Math.max(...active.map((h) => h.hour));
  const bars = hourly.slice(min, max + 1);
  const peak = Math.max(1, ...bars.map((b) => b.revenue));
  return (
    <div className="flex h-28 items-end gap-1">
      {bars.map((b) => (
        <div key={b.hour} className="flex flex-1 flex-col items-center gap-1" title={`${b.hour}:00 — ${formatPrice(b.revenue)}`}>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-accent-500/80"
              style={{ height: `${b.revenue ? Math.max(3, (b.revenue / peak) * 100) : 0}%` }}
            />
          </div>
          <span className="text-[9px] tabular-nums text-slate-400">{b.hour}</span>
        </div>
      ))}
    </div>
  );
}

function TrendBars({ series }: { series: SalesReport["series"] }) {
  const peak = Math.max(1, ...series.map((s) => s.netSales));
  return (
    <div className="flex h-32 items-end gap-1 overflow-x-auto">
      {series.map((s) => {
        const day = s.date.slice(8);
        return (
          <div key={s.date} className="flex min-w-[14px] flex-1 flex-col items-center gap-1" title={`${s.date} — ${formatPrice(s.netSales)} · ${s.tabs} tabs`}>
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t bg-accent-500/80"
                style={{ height: `${s.netSales ? Math.max(3, (s.netSales / peak) * 100) : 0}%` }}
              />
            </div>
            <span className="text-[9px] tabular-nums text-slate-400">{day}</span>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="break-inside-avoid rounded-xl border border-slate-200 bg-white p-3 print:border-slate-300">
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={cn("tabular-nums", strong ? "font-bold text-slate-900" : "text-slate-700")}>
        {value}
      </span>
    </div>
  );
}

function ReportTable({
  head,
  rows,
  foot,
}: {
  head: string[];
  rows: string[][];
  foot?: string[];
}) {
  if (rows.length === 0) return <p className="text-sm text-slate-400">None.</p>;
  return (
    <table className="w-full min-w-[34rem] text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
          {head.map((h, i) => (
            <th key={h} className={cn("py-1.5 font-semibold", i === 0 ? "text-left" : "text-right")}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className="border-b border-slate-100">
            {r.map((cell, ci) => (
              <td
                key={ci}
                className={cn(
                  "py-1.5",
                  ci === 0 ? "font-medium text-slate-800" : "text-right tabular-nums text-slate-700"
                )}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {foot && (
        <tfoot>
          <tr className="font-bold text-slate-900">
            {foot.map((cell, ci) => (
              <td key={ci} className={cn("py-2", ci === 0 ? "text-left" : "text-right tabular-nums")}>
                {cell}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
}
