import { randomBytes } from 'node:crypto';

// Unambiguous uppercase alphabet (no 0/O/1/I) — table codes live in QR URLs and
// may occasionally be read aloud, so we avoid look-alike characters.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * A random table code for QR URLs. Codes are globally unique (Table.code is
 * unique storewide), so tenants never collide on a human-typed code — the
 * server mints these instead. 8 chars over a 32-symbol alphabet ≈ 10^12 space.
 */
export function randomTableCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
