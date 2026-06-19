/**
 * ASCII URL slug: lowercase, runs of non-alphanumerics collapse to a single
 * dash, trimmed, capped at 40 chars. Returns '' for input with no usable ASCII
 * (e.g. a purely non-latin name) — callers should fall back to a default.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}
