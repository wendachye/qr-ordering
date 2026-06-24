import { PrismaClient } from '@prisma/client';

import { config } from '../config/env';
import { makePrismaClient } from './makePrisma';
import { makeAuditExtension } from './auditExtension';

// The runtime client: a pg-adapter PrismaClient extended for audit attribution +
// soft delete on the audited models (auditExtension). Services import this
// singleton, so every write/read goes through that layer. The extension keeps a
// handle on the un-extended `base` client to re-dispatch hard deletes as
// soft-delete updates.
function createPrismaClient() {
  const base = makePrismaClient({
    connectionString: config.databaseUrl,
    log: config.isProduction ? ['error'] : ['error', 'warn'],
  });
  return base.$extends(makeAuditExtension(base));
}

// Reuse a single client across hot reloads in dev to avoid exhausting the pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// `auditStampsExtension` only adds query hooks — it exposes no new public
// methods/fields — so the extended client is structurally identical to
// PrismaClient for callers. Typing the export as PrismaClient keeps existing
// `$transaction` tx + helper signatures (Prisma.TransactionClient) valid while
// the stamping still runs at runtime.
export const prisma: PrismaClient =
  globalForPrisma.prisma ?? (createPrismaClient() as unknown as PrismaClient);

if (!config.isProduction) {
  globalForPrisma.prisma = prisma;
}
