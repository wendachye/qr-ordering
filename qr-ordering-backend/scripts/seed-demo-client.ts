/**
 * scripts/seed-demo-client.ts — DEV demo data for the platform console.
 *
 * Resets the platform-console demo to a SINGLE client ("Demo F&B Group") with
 * three outlets (mixed plans + demo logins). The platform super-admin's own
 * seeded store is KEPT; every other store/client (leftover test data) is DELETED.
 *
 * DESTRUCTIVE + idempotent (safe to re-run — it rebuilds from scratch each time).
 * Refuses to run with NODE_ENV=production. Run after `npm run db:seed`.
 *   npm run db:demo
 */
import { prisma } from '../src/lib/prisma';
import { addOutlet, createClient } from '../src/modules/admin/clients.service';

// Delete every store-scoped row in FK-safe order (children before parents), then
// the store itself. Order->OrderItem/PrintJob and MenuItem->options cascade in the
// schema; the rest are Restrict, so they're removed explicitly.
async function deleteStoreData(storeId: string) {
  await prisma.$transaction([
    prisma.voucherRedemption.deleteMany({ where: { storeId } }),
    prisma.rewardRedemption.deleteMany({ where: { storeId } }),
    prisma.pointsLedger.deleteMany({ where: { storeId } }),
    prisma.stampLedger.deleteMany({ where: { storeId } }),
    prisma.order.deleteMany({ where: { storeId } }), // cascades OrderItem + PrintJob
    prisma.tableSession.deleteMany({ where: { storeId } }),
    prisma.member.deleteMany({ where: { storeId } }),
    prisma.voucher.deleteMany({ where: { storeId } }),
    prisma.rewardCatalog.deleteMany({ where: { storeId } }),
    prisma.otpChallenge.deleteMany({ where: { storeId } }),
    prisma.menuItem.deleteMany({ where: { storeId } }), // cascades OptionGroup + OptionChoice
    prisma.menuCategory.deleteMany({ where: { storeId } }),
    prisma.table.deleteMany({ where: { storeId } }),
    prisma.adminUser.deleteMany({ where: { storeId } }),
    prisma.store.delete({ where: { id: storeId } }),
  ]);
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run the demo reset in production.');
  }

  // Keep the platform super-admin's own store + client; remove everything else.
  const superAdmin = await prisma.adminUser.findFirst({
    where: { isPlatformAdmin: true },
    select: { storeId: true, email: true },
  });
  if (!superAdmin) throw new Error('No platform super-admin found — run `npm run db:seed` first.');

  const keptStore = await prisma.store.findUnique({
    where: { id: superAdmin.storeId },
    select: { id: true, name: true, clientId: true },
  });
  if (!keptStore) throw new Error('Super-admin store not found.');

  const junkStores = await prisma.store.findMany({
    where: { id: { not: keptStore.id } },
    select: { id: true, name: true },
  });
  console.log(`Keeping operator store: "${keptStore.name}" (${superAdmin.email})`);
  console.log(
    `Deleting ${junkStores.length} other store(s): ${junkStores.map((s) => s.name).join(', ') || '(none)'}`,
  );
  for (const s of junkStores) await deleteStoreData(s.id);

  const delClients = await prisma.client.deleteMany({
    where: keptStore.clientId ? { id: { not: keptStore.clientId } } : {},
  });
  console.log(`Deleted ${delClients.count} other client(s).`);

  // One demo client, three outlets (mixed plans + demo admin logins, pw: password123).
  const demo = await createClient({
    clientName: 'Demo F&B Group',
    contactEmail: 'ops@demofnb.test',
    contactPhone: '+60 12-345 6789',
    notes: 'Demo restaurant group for the platform-console walkthrough.',
    outletName: 'Demo F&B — KLCC',
    planKey: 'pro',
    trialDays: 0,
    adminEmail: 'klcc@demofnb.test',
    adminPassword: 'password123',
  });
  await addOutlet(demo.id, {
    outletName: 'Demo F&B — Bangsar',
    planKey: 'basic',
    trialDays: 14,
    adminEmail: 'bangsar@demofnb.test',
    adminPassword: 'password123',
  });
  const full = await addOutlet(demo.id, {
    outletName: 'Demo F&B — Penang',
    planKey: 'pro',
    trialDays: 0,
    adminEmail: 'penang@demofnb.test',
    adminPassword: 'password123',
  });

  console.log(`\nDemo client created: "${full.name}" — ${full.outletCount} outlets`);
  for (const o of full.outlets) {
    console.log(
      `   - ${o.name}  [${o.plan}/${o.subscriptionStatus}]  ${o.tableCount} tables, ${o.menuItemCount} item(s)`,
    );
  }
  console.log('\nOutlet logins: klcc@ / bangsar@ / penang@demofnb.test  (password: password123)');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
