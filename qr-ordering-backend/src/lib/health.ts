import { prisma } from './prisma';

// Flipped to false on shutdown so /health/ready returns 503 and the load
// balancer drains this instance before we stop accepting connections.
let accepting = true;

export function setDraining(): void {
  accepting = false;
}

export function isAccepting(): boolean {
  return accepting;
}

/**
 * Readiness = accepting traffic AND the database is reachable. Liveness (the
 * process is up) is a separate, dependency-free check.
 */
export async function checkReadiness(): Promise<{
  ready: boolean;
  db: boolean;
  accepting: boolean;
}> {
  let db = false;
  try {
    // Bound the check so /health/ready answers fast even when the DB is wedged.
    // The pg driver adapter has no engine-level pool timeout; makePrisma sets an
    // explicit statement_timeout so an abandoned SELECT 1 cancels server-side and
    // releases its pooled connection instead of stranding it.
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('db check timed out')), 2000)),
    ]);
    db = true;
  } catch {
    db = false;
  }
  return { ready: accepting && db, db, accepting };
}
