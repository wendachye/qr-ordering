import type { Settings } from "./types";

export type ChargeBreakdown = {
  subtotal: number;
  serviceChargeRate: number;
  serviceCharge: number;
  taxes: { name: string; rate: number; amount: number }[];
  total: number;
  hasCharges: boolean;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Decompose a tax-INCLUSIVE total into its subtotal, service charge, and each
 * configured tax (each applied on subtotal + service charge). Mirrors the
 * report's back-out so the on-screen bill matches the Z reading. When nothing is
 * configured, hasCharges is false and the subtotal equals the total.
 */
export function decomposeInclusive(
  total: number,
  serviceChargeRate: number,
  taxes: { name: string; rate: number }[]
): ChargeBreakdown {
  const sc = (serviceChargeRate || 0) / 100;
  const list = taxes ?? [];
  const totalTaxRate = list.reduce((s, t) => s + (t.rate || 0) / 100, 0);
  const base2 = total / (1 + totalTaxRate); // subtotal + service charge
  const serviceCharge = r2((base2 / (1 + sc)) * sc);
  const taxLines = list.map((t) => ({
    name: t.name,
    rate: t.rate,
    amount: r2(base2 * ((t.rate || 0) / 100)),
  }));
  const totalTax = r2(taxLines.reduce((s, t) => s + t.amount, 0));
  const subtotal = r2(total - serviceCharge - totalTax);
  return {
    subtotal,
    serviceChargeRate: serviceChargeRate || 0,
    serviceCharge,
    taxes: taxLines,
    total: r2(total),
    hasCharges: sc > 0 || taxLines.length > 0,
  };
}

export function chargesFromSettings(
  total: number,
  settings?: Pick<Settings, "serviceChargeRate" | "taxes"> | null
): ChargeBreakdown {
  return decomposeInclusive(total, settings?.serviceChargeRate ?? 0, settings?.taxes ?? []);
}
