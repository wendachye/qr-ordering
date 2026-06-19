import { makePrismaClient } from '../src/lib/makePrisma';

// Runs once before the suite so tests are deterministic regardless of state a
// previous run left in the (persistent) test DB:
//  - clears any lockout on the seeded admin (so admin-login tests never 423)
//  - frees the demo store's tables (closes leftover OPEN sessions)
export default async function setup() {
  const prisma = makePrismaClient();
  try {
    await prisma.adminUser.updateMany({
      where: { email: 'admin@example.com' },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    const demo = await prisma.store.findUnique({ where: { slug: 'demo-restaurant' } });
    if (demo) {
      await prisma.tableSession.updateMany({
        where: { storeId: demo.id, status: 'OPEN' },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}
