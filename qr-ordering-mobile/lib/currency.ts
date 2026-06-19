// Format a number as Malaysian Ringgit, e.g. 12 -> "RM12.00".
export function formatPrice(amount: number): string {
  return `RM${amount.toFixed(2)}`;
}
