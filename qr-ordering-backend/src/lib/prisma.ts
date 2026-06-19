import { config } from '../config/env';
import { makePrismaClient } from './makePrisma';

// Reuse a single PrismaClient across hot reloads in dev to avoid exhausting
// the connection pool.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof makePrismaClient>;
};

export const prisma =
  globalForPrisma.prisma ??
  makePrismaClient({
    connectionString: config.databaseUrl,
    log: config.isProduction ? ['error'] : ['error', 'warn'],
  });

if (!config.isProduction) {
  globalForPrisma.prisma = prisma;
}
