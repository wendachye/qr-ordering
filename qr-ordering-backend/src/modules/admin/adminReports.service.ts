import { prisma } from '../../lib/prisma';
import { getDefaultStoreId } from '../../lib/store';
import {
  featureLockedError,
  hasFeature,
  resolveEntitlementsForStore,
} from '../../lib/entitlements';
import { parseTaxes } from './adminSettings.service';

// Round to cents to avoid float-summing artefacts (Decimal(10,2) source data).
const round2 = (n: number): number => Math.round(n * 100) / 100;
const pct = (part: number, whole: number): number => (whole ? round2((part / whole) * 100) : 0);

function startOfDay(y: number, mZero: number, d: number): Date {
  return new Date(y, mZero, d, 0, 0, 0, 0);
}
function parseYmd(s: string): { y: number; mZero: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y, mZero: m - 1, d };
}
function ymd(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate(),
  ).padStart(2, '0')}`;
}

/**
 * Resolve an inclusive local business-day range [start, end) from two YYYY-MM-DD
 * strings. `from` defaults to today; `to` defaults to `from` (a single day = a
 * classic Z reading). The venue runs in its own local timezone, so a business
 * day is the local calendar day.
 */
function resolveRange(fromInput?: string, toInput?: string) {
  const now = new Date();
  const f = fromInput
    ? parseYmd(fromInput)
    : { y: now.getFullYear(), mZero: now.getMonth(), d: now.getDate() };
  let t = toInput ? parseYmd(toInput) : f;
  const start = startOfDay(f.y, f.mZero, f.d);
  let endExclusive = startOfDay(t.y, t.mZero, t.d + 1); // day after `to`
  // Guard against an inverted range — collapse to the single `from` day.
  if (endExclusive <= start) {
    t = f;
    endExclusive = startOfDay(f.y, f.mZero, f.d + 1);
  }
  const fromStr = ymd(start);
  const toStr = ymd(startOfDay(t.y, t.mZero, t.d));
  const days = Math.max(1, Math.round((endExclusive.getTime() - start.getTime()) / 86_400_000));

  let kind: 'day' | 'month' | 'range' = 'range';
  if (fromStr === toStr) {
    kind = 'day';
  } else {
    const lastDay = new Date(t.y, t.mZero + 1, 0).getDate();
    if (f.d === 1 && t.y === f.y && t.mZero === f.mZero && t.d === lastDay) kind = 'month';
  }
  return { start, endExclusive, fromStr, toStr, days, kind };
}

// F&B dayparts, bucketed by settlement (close) time.
const DAYPARTS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'late', label: 'Late night' },
] as const;
function daypartKey(hour: number): (typeof DAYPARTS)[number]['key'] {
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'dinner';
  return 'late';
}

/**
 * Sales report for a business-day range (one day = a Z reading; a month or
 * custom range aggregates the same breakdowns).
 *
 * "Sales" are recognised at settlement: only sessions CLOSED within the range
 * count, grouped by `closedAt`. Cancelled rounds inside a settled tab are
 * excluded from the money; voided items and voided (CANCELLED) tabs are reported
 * separately so the numbers reconcile against the drawer.
 *
 * Menu prices are tax-inclusive: when a service charge / tax rate is configured,
 * the collected net is decomposed (backed out) into Subtotal → Service charge →
 * Tax → Total, without changing what was actually collected.
 */
export async function getSalesReport(fromInput?: string, toInput?: string) {
  const storeId = await getDefaultStoreId();
  const { start, endExclusive, fromStr, toStr, days, kind } = resolveRange(fromInput, toInput);

  // The single-day Z-reading is on every plan; multi-day / month aggregates are
  // the "advanced reports" feature.
  if (kind !== 'day') {
    const ent = await resolveEntitlementsForStore(storeId);
    if (!hasFeature(ent, 'reports_advanced')) throw featureLockedError('reports_advanced');
  }

  const [store, settledSessions, cancelledSessions, voidedItems] = await Promise.all([
    prisma.store.findUnique({
      where: { id: storeId },
      select: { name: true, serviceChargeRate: true, taxes: true },
    }),
    prisma.tableSession.findMany({
      where: { storeId, status: 'CLOSED', closedAt: { gte: start, lt: endExclusive } },
      orderBy: { closedAt: 'asc' },
      select: {
        sessionNumber: true,
        tableId: true,
        pax: true,
        paymentMethod: true,
        discountAmount: true,
        voucherCode: true,
        voucherDiscount: true,
        loyaltyDiscount: true,
        openedAt: true,
        closedAt: true,
        table: { select: { name: true } },
        payments: { where: { voided: false }, select: { tip: true } },
        orders: {
          where: { status: { not: 'CANCELLED' } },
          select: {
            items: {
              select: {
                name: true,
                quantity: true,
                totalPrice: true,
                discountAmount: true,
                isTakeaway: true,
                takeawayCharge: true,
                voided: true,
                menuItem: { select: { category: { select: { name: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.tableSession.findMany({
      where: { storeId, status: 'CANCELLED', closedAt: { gte: start, lt: endExclusive } },
      select: { orders: { select: { total: true } } },
    }),
    // Item-level voids that happened in the window (independent of settlement).
    prisma.orderItem.findMany({
      where: { voided: true, voidedAt: { gte: start, lt: endExclusive }, order: { storeId } },
      select: { name: true, quantity: true, totalPrice: true, voidReason: true },
    }),
  ]);

  // --- Accumulators ---
  let grossSales = 0; // menu value before any discount (incl. takeaway charge)
  let itemDiscountTotal = 0;
  let billDiscountTotal = 0;
  let ordersCount = 0;
  let itemsSold = 0;
  let discountedItems = 0;
  let discountedTabs = 0;
  let covers = 0;
  let diningMinutes = 0;
  let diningSessions = 0;
  let takeawayChargeTotal = 0;
  let voucherDiscountTotal = 0;
  let loyaltyDiscountTotal = 0; // points redeemed as bill discounts
  let tipsTotal = 0; // gratuity collected on top of the bill (not sales)

  const voucherByCode = new Map<string, { count: number; amount: number }>();
  const byCategory = new Map<string, { quantity: number; revenue: number }>();
  const byItem = new Map<string, { quantity: number; revenue: number }>();
  const byPayment = new Map<string, { tabs: number; amount: number }>();
  const channel = {
    dineIn: { items: 0, revenue: 0 },
    takeaway: { items: 0, revenue: 0 },
  };
  const dayparts = new Map<string, { tabs: number; covers: number; revenue: number }>();
  const hourly = Array.from({ length: 24 }, () => ({ revenue: 0, tabs: 0 }));
  const series = new Map<
    string,
    { netSales: number; grossSales: number; tabs: number; covers: number }
  >();
  const tablesUsed = new Set<string>();
  const billNumbers: number[] = [];

  const tabs = settledSessions.map((s) => {
    let tabRevenue = 0; // sum of collected line totals (after item discounts)
    let tabGross = 0; // menu value before any discount (mirrors grossSales)
    let tabItems = 0;
    // Per-tab channel revenue, so a bill discount can be split pro-rata below.
    let tabDineIn = 0;
    let tabTakeaway = 0;
    let tabDineInItems = 0;
    let tabTakeawayItems = 0;
    for (const o of s.orders) {
      ordersCount += 1;
      for (const it of o.items) {
        if (it.voided) continue; // voided items aren't sales
        const lineRevenue = Number(it.totalPrice); // after item discount, incl. takeaway
        const lineDiscount = Number(it.discountAmount);
        grossSales += lineRevenue + lineDiscount;
        itemDiscountTotal += lineDiscount;
        if (lineDiscount > 0) discountedItems += 1;
        itemsSold += it.quantity;
        tabRevenue += lineRevenue;
        tabGross += lineRevenue + lineDiscount;
        tabItems += it.quantity;

        const catName = it.menuItem?.category?.name ?? 'Custom items';
        const cat = byCategory.get(catName) ?? { quantity: 0, revenue: 0 };
        cat.quantity += it.quantity;
        cat.revenue += lineRevenue;
        byCategory.set(catName, cat);

        const item = byItem.get(it.name) ?? { quantity: 0, revenue: 0 };
        item.quantity += it.quantity;
        item.revenue += lineRevenue;
        byItem.set(it.name, item);

        if (it.isTakeaway) {
          tabTakeaway += lineRevenue;
          tabTakeawayItems += it.quantity;
          takeawayChargeTotal += Number(it.takeawayCharge) * it.quantity;
        } else {
          tabDineIn += lineRevenue;
          tabDineInItems += it.quantity;
        }
      }
    }

    const billDiscount = Number(s.discountAmount);
    billDiscountTotal += billDiscount;
    if (billDiscount > 0) discountedTabs += 1;
    const voucherDiscount = Number(s.voucherDiscount);
    voucherDiscountTotal += voucherDiscount;
    if (voucherDiscount > 0 && s.voucherCode) {
      const vc = voucherByCode.get(s.voucherCode) ?? { count: 0, amount: 0 };
      vc.count += 1;
      vc.amount += voucherDiscount;
      voucherByCode.set(s.voucherCode, vc);
    }
    const loyaltyDiscount = Number(s.loyaltyDiscount);
    loyaltyDiscountTotal += loyaltyDiscount;
    const tabNet = round2(tabRevenue - billDiscount - voucherDiscount - loyaltyDiscount);

    // Split the tab's NET (after its bill discount) across channels pro-rata by
    // each channel's share of the tab, so dine-in + takeaway reconciles to net.
    const dineInNet = round2(tabRevenue > 0 ? (tabDineIn / tabRevenue) * tabNet : 0);
    channel.dineIn.items += tabDineInItems;
    channel.dineIn.revenue += dineInNet;
    channel.takeaway.items += tabTakeawayItems;
    channel.takeaway.revenue += round2(tabNet - dineInNet);

    const method = s.paymentMethod ?? 'Unrecorded';
    const pay = byPayment.get(method) ?? { tabs: 0, amount: 0 };
    pay.tabs += 1;
    pay.amount += tabNet;
    byPayment.set(method, pay);

    tipsTotal += s.payments.reduce((x, p) => x + Number(p.tip), 0);
    covers += s.pax ?? 0;
    tablesUsed.add(s.tableId);
    billNumbers.push(s.sessionNumber);

    if (s.closedAt) {
      const closed = s.closedAt;
      const dpKey = daypartKey(closed.getHours());
      const dp = dayparts.get(dpKey) ?? { tabs: 0, covers: 0, revenue: 0 };
      dp.tabs += 1;
      dp.covers += s.pax ?? 0;
      dp.revenue += tabNet;
      dayparts.set(dpKey, dp);

      const h = hourly[closed.getHours()];
      h.revenue += tabNet;
      h.tabs += 1;

      const dayKey = ymd(closed);
      const day = series.get(dayKey) ?? { netSales: 0, grossSales: 0, tabs: 0, covers: 0 };
      day.netSales += tabNet;
      day.grossSales += tabGross;
      day.tabs += 1;
      day.covers += s.pax ?? 0;
      series.set(dayKey, day);

      if (s.openedAt) {
        diningMinutes += (closed.getTime() - s.openedAt.getTime()) / 60_000;
        diningSessions += 1;
      }
    }

    return {
      sessionNumber: s.sessionNumber,
      tableName: s.table.name,
      pax: s.pax,
      paymentMethod: s.paymentMethod,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      orders: s.orders.length,
      items: tabItems,
      discount: round2(billDiscount),
      total: tabNet,
    };
  });

  const tabsSettled = settledSessions.length;
  const netSales = round2(
    grossSales - itemDiscountTotal - billDiscountTotal - voucherDiscountTotal - loyaltyDiscountTotal,
  );
  const totalDiscounts = round2(itemDiscountTotal + billDiscountTotal);
  const categoryRevenueTotal = round2(grossSales - itemDiscountTotal); // == sum of line revenue

  // --- Tax-inclusive back-out: decompose the collected net into a subtotal,
  // the service charge, and each configured tax (applied on subtotal + service). ---
  const scRate = Number(store?.serviceChargeRate ?? 0) / 100;
  const taxList = parseTaxes(store?.taxes);
  const totalTaxRate = taxList.reduce((s, t) => s + t.rate / 100, 0);
  const base2 = netSales / (1 + totalTaxRate); // subtotal + service charge
  const serviceCharge = round2((base2 / (1 + scRate)) * scRate);
  const taxes = taxList.map((t) => ({
    name: t.name,
    rate: round2(t.rate),
    amount: round2(base2 * (t.rate / 100)),
  }));
  const totalTax = round2(taxes.reduce((s, t) => s + t.amount, 0));
  const subtotalExCharges = round2(netSales - serviceCharge - totalTax);

  // --- Voids ---
  const voidItemAmount = voidedItems.reduce((sum, v) => sum + Number(v.totalPrice), 0);
  const voidByReason = new Map<string, { count: number; amount: number }>();
  for (const v of voidedItems) {
    const reason = v.voidReason?.trim() || 'No reason given';
    const r = voidByReason.get(reason) ?? { count: 0, amount: 0 };
    r.count += 1;
    r.amount += Number(v.totalPrice);
    voidByReason.set(reason, r);
  }
  const cancelledAmount = cancelledSessions.reduce(
    (sum, s) => sum + s.orders.reduce((x, o) => x + Number(o.total), 0),
    0,
  );
  const cancelledRounds = cancelledSessions.reduce((sum, s) => sum + s.orders.length, 0);

  return {
    period: { from: fromStr, to: toStr, days, kind },
    storeName: store?.name ?? 'Store',
    generatedAt: new Date(),
    charges: {
      serviceChargeRate: round2(scRate * 100),
      taxes: taxList.map((t) => ({ name: t.name, rate: round2(t.rate) })),
    },
    sales: {
      grossSales: round2(grossSales),
      itemDiscounts: round2(itemDiscountTotal),
      billDiscounts: round2(billDiscountTotal),
      voucherDiscounts: round2(voucherDiscountTotal),
      totalDiscounts,
      netSales,
      // Tax-inclusive decomposition of the collected net.
      subtotalExCharges,
      serviceCharge,
      taxes,
      totalTax,
      totalCollected: netSales,
      takeawayCharges: round2(takeawayChargeTotal),
      // Gratuity collected on top of net sales (staff money, not revenue). The
      // drawer holds netSales + tips.
      tips: round2(tipsTotal),
      grandTotalCollected: round2(netSales + tipsTotal),
    },
    counts: {
      tabsSettled,
      orders: ordersCount,
      itemsSold,
      covers,
      tablesUsed: tablesUsed.size,
      discountedItems,
      discountedTabs,
    },
    averages: {
      perTab: tabsSettled ? round2(netSales / tabsSettled) : 0,
      perOrder: ordersCount ? round2(netSales / ordersCount) : 0,
      perCover: covers ? round2(netSales / covers) : 0,
      itemsPerTab: tabsSettled ? round2(itemsSold / tabsSettled) : 0,
      tableTurns: tablesUsed.size ? round2(tabsSettled / tablesUsed.size) : 0,
      diningMinutes: diningSessions ? Math.round(diningMinutes / diningSessions) : 0,
      salesPerDay: round2(netSales / days),
    },
    byCategory: [...byCategory.entries()]
      .map(([category, v]) => ({
        category,
        quantity: v.quantity,
        revenue: round2(v.revenue),
        pct: pct(v.revenue, categoryRevenueTotal),
      }))
      .sort((a, b) => b.revenue - a.revenue),
    items: [...byItem.entries()]
      .map(([name, v]) => ({ name, quantity: v.quantity, revenue: round2(v.revenue) }))
      .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity),
    byPayment: [...byPayment.entries()]
      .map(([method, v]) => ({
        method,
        tabs: v.tabs,
        amount: round2(v.amount),
        pct: pct(v.amount, netSales),
      }))
      .sort((a, b) => b.amount - a.amount),
    channels: {
      dineIn: { items: channel.dineIn.items, revenue: round2(channel.dineIn.revenue) },
      takeaway: {
        items: channel.takeaway.items,
        revenue: round2(channel.takeaway.revenue),
        charges: round2(takeawayChargeTotal),
      },
    },
    dayparts: DAYPARTS.map((dp) => {
      const v = dayparts.get(dp.key) ?? { tabs: 0, covers: 0, revenue: 0 };
      return {
        key: dp.key,
        label: dp.label,
        tabs: v.tabs,
        covers: v.covers,
        revenue: round2(v.revenue),
        pct: pct(v.revenue, netSales),
      };
    }),
    hourly: hourly.map((h, hour) => ({ hour, revenue: round2(h.revenue), tabs: h.tabs })),
    series: [...series.entries()]
      .map(([date, v]) => ({
        date,
        netSales: round2(v.netSales),
        grossSales: round2(v.grossSales),
        tabs: v.tabs,
        covers: v.covers,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    discounts: {
      items: round2(itemDiscountTotal),
      bill: round2(billDiscountTotal),
      total: totalDiscounts,
      pctOfGross: pct(totalDiscounts, grossSales),
      discountedItems,
      discountedTabs,
    },
    voids: {
      items: { count: voidedItems.length, amount: round2(voidItemAmount) },
      tabs: {
        count: cancelledSessions.length,
        rounds: cancelledRounds,
        amount: round2(cancelledAmount),
      },
      byReason: [...voidByReason.entries()]
        .map(([reason, v]) => ({ reason, count: v.count, amount: round2(v.amount) }))
        .sort((a, b) => b.amount - a.amount),
    },
    vouchers: {
      count: [...voucherByCode.values()].reduce((s, v) => s + v.count, 0),
      amount: round2(voucherDiscountTotal),
      byCode: [...voucherByCode.entries()]
        .map(([code, v]) => ({ code, count: v.count, amount: round2(v.amount) }))
        .sort((a, b) => b.amount - a.amount),
    },
    audit: {
      firstBillNumber: billNumbers.length ? Math.min(...billNumbers) : null,
      lastBillNumber: billNumbers.length ? Math.max(...billNumbers) : null,
      billCount: tabsSettled,
      firstCloseAt: tabs.length ? tabs[0].closedAt : null,
      lastCloseAt: tabs.length ? tabs[tabs.length - 1].closedAt : null,
    },
    tabs,
  };
}
