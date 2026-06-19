// Natural ("Table 2" before "Table 10") string comparison for table ordering —
// plain alpha sort would otherwise interleave 1, 10, 11, 2, …
export function compareNatural(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}
