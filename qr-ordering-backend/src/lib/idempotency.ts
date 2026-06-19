import { Prisma } from '@prisma/client';

import { prisma } from './prisma';
import { ApiError } from './response';

/**
 * Run an order-creating operation at most once per Idempotency-Key. The key row
 * is claimed (a unique insert) BEFORE the work runs, so a concurrent replay loses
 * the race and returns the original response instead of creating a second order.
 *
 *  - no key            → run normally (no de-dupe)
 *  - key, first time   → claim, run, store response, return { replayed: false }
 *  - key, completed    → return the stored response, { replayed: true }
 *  - key, still in-flight → 409 (the first request hasn't finished yet)
 */
// An in-flight claim older than this is treated as orphaned (the original
// request crashed/aborted) and reclaimed, so a dead request can't permanently
// 409 every future retry of the same key.
const STALE_CLAIM_MS = 60_000;

export async function runIdempotent<T>(
  scope: string,
  key: string | undefined,
  fn: () => Promise<T>,
): Promise<{ data: T; replayed: boolean }> {
  if (!key) return { data: await fn(), replayed: false };

  // Namespace the key by its tenant scope (the table code, which maps 1:1 to a
  // store) so one store can never collide with — or hijack — another's keys.
  const storedKey = `${scope}:${key}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    // Claim the key. A duplicate insert (P2002) means someone already has it.
    try {
      await prisma.idempotencyKey.create({ data: { key: storedKey } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await prisma.idempotencyKey.findUnique({ where: { key: storedKey } });
        if (existing?.response != null) {
          return { data: existing.response as T, replayed: true };
        }
        // In-flight. If the claim is stale (its request died), reclaim and retry.
        if (existing && Date.now() - existing.createdAt.getTime() > STALE_CLAIM_MS) {
          await prisma.idempotencyKey.delete({ where: { key: storedKey } }).catch(() => undefined);
          continue;
        }
        throw ApiError.conflict('A request with this Idempotency-Key is still being processed');
      }
      throw err;
    }

    try {
      const data = await fn();
      await prisma.idempotencyKey.update({
        where: { key: storedKey },
        data: { response: data as unknown as Prisma.InputJsonValue, completedAt: new Date() },
      });
      return { data, replayed: false };
    } catch (err) {
      // Release the claim so the client can legitimately retry after a failure.
      await prisma.idempotencyKey.delete({ where: { key: storedKey } }).catch(() => undefined);
      throw err;
    }
  }

  throw ApiError.conflict('A request with this Idempotency-Key is still being processed');
}

/** Pull + validate an Idempotency-Key header (8–200 chars), or undefined. */
export function idempotencyKeyFrom(headerVal: unknown): string | undefined {
  const v = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  if (typeof v !== 'string') return undefined;
  const key = v.trim();
  if (key.length < 8 || key.length > 200) return undefined;
  return key;
}
