import { Prisma } from '@prisma/client';

/**
 * The effective (sale) unit price of a menu item after an optional standing
 * menu discount. PERCENT: price × (1 − value/100); FIXED: price − value.
 * Floored at 0 and rounded to cents. Returns the original price (2dp) when no
 * discount is configured. Options/add-ons are priced on top at full value.
 */
export function effectiveItemPrice(
  price: Prisma.Decimal | number,
  discountType: string | null | undefined,
  discountValue: Prisma.Decimal | number | null | undefined,
): Prisma.Decimal {
  const p = new Prisma.Decimal(price);
  if (!discountType) return p.toDecimalPlaces(2);
  const v = new Prisma.Decimal(discountValue ?? 0);
  let amount =
    discountType === 'PERCENT' ? p.mul(Prisma.Decimal.min(new Prisma.Decimal(100), v)).div(100) : v;
  if (amount.greaterThan(p)) amount = p; // never below zero
  if (amount.lessThan(0)) amount = new Prisma.Decimal(0);
  return p.sub(amount).toDecimalPlaces(2);
}

/**
 * The sale price as a Number for client display, or null when there is no
 * active discount (so clients fall back to the regular price).
 */
export function salePriceOf(
  price: Prisma.Decimal | number,
  discountType: string | null | undefined,
  discountValue: Prisma.Decimal | number | null | undefined,
): number | null {
  if (!discountType) return null;
  const eff = effectiveItemPrice(price, discountType, discountValue);
  return eff.lessThan(new Prisma.Decimal(price)) ? Number(eff) : null;
}
