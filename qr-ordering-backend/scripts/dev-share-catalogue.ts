// Dev-only: make the demo store's catalogue SHARED by adding a sibling outlet
// that points at the same catalogueId, so the admin's per-outlet override UI
// (which only appears when outletCount > 1) becomes exercisable in the browser.
// Idempotent: re-running just ensures the sibling exists.
import { prisma } from '../src/lib/prisma';

async function main() {
  const demo = await prisma.store.findUnique({
    where: { slug: 'demo-restaurant' },
    select: { id: true, catalogueId: true, clientId: true, name: true },
  });
  if (!demo?.catalogueId) throw new Error('Demo store has no catalogue — run db:seed first.');

  const sibling = await prisma.store.upsert({
    where: { slug: 'demo-restaurant-2' },
    update: { catalogueId: demo.catalogueId, clientId: demo.clientId },
    create: {
      name: `${demo.name} (Branch 2)`,
      slug: 'demo-restaurant-2',
      catalogueId: demo.catalogueId,
      clientId: demo.clientId,
    },
    select: { id: true, name: true, slug: true },
  });

  const count = await prisma.store.count({ where: { catalogueId: demo.catalogueId } });
  console.log(
    `Catalogue ${demo.catalogueId} now shared by ${count} outlets (added ${sibling.slug}).`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
