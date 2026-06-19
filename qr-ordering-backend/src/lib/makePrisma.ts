import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

type ClientLog = ('error' | 'warn' | 'info' | 'query')[];

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Construct a PrismaClient wired to the pg driver adapter. Prisma 7 dropped the
 * bundled query engine, so every client must be built with an adapter.
 *
 * The pg adapter — unlike Prisma 6's engine — does NOT read the `?schema=` URL
 * param and has no default pool/acquire timeout, so we set them explicitly:
 *  - parse `schema` out of the URL and pass it through, so a non-public schema
 *    still resolves (otherwise queries rely on Postgres's default search_path);
 *  - bound the pool (`max`) and connection acquisition (`connectionTimeoutMillis`)
 *    so a saturated/wedged DB sheds load instead of hanging requests forever
 *    (Prisma 6 used to fail fast with P2024);
 *  - `statement_timeout` cancels abandoned queries (e.g. a timed-out readiness
 *    probe's `SELECT 1`) server-side so they release their pooled connection.
 *
 * Sizing is tunable via DB_POOL_MAX / DB_CONNECTION_TIMEOUT_MS / DB_STATEMENT_TIMEOUT_MS.
 */
export function makePrismaClient(
  opts: { connectionString?: string; log?: ClientLog } = {},
): PrismaClient {
  const { connectionString = process.env.DATABASE_URL, log } = opts;

  let schema: string | undefined;
  if (connectionString) {
    try {
      schema = new URL(connectionString).searchParams.get('schema') ?? undefined;
    } catch {
      // Non-URL connection string (e.g. a unix socket DSN) — leave schema unset.
    }
  }

  const adapter = new PrismaPg(
    {
      connectionString,
      max: num(process.env.DB_POOL_MAX, 10),
      connectionTimeoutMillis: num(process.env.DB_CONNECTION_TIMEOUT_MS, 10_000),
      statement_timeout: num(process.env.DB_STATEMENT_TIMEOUT_MS, 20_000),
    },
    schema ? { schema } : undefined,
  );

  return new PrismaClient({ adapter, ...(log ? { log } : {}) });
}
