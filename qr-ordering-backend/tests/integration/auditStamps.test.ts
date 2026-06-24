import { randomUUID } from 'node:crypto';

import { describe, it, expect } from 'vitest';

import { api, registerTenant, uid } from '../helpers';
import { prisma } from '../../src/lib/prisma';
import { requestContext, withDeleted } from '../../src/lib/requestContext';

// Run a thunk as if inside an authenticated request by `actorId` — mirrors what
// requireAdmin establishes on a real request (the audit-log tests cover that the
// middleware actually sets this context; here we exercise the stamping itself).
function asActor<T>(actorId: string, fn: () => Promise<T>): Promise<T> {
  // Await INSIDE run() so the (lazy) Prisma query — and the stamping hook that
  // reads currentActor() — executes while the ALS context is still active, the
  // same way an async route handler awaits within requireAdmin's context.
  return requestContext.run(
    { requestId: randomUUID(), actor: { id: actorId, email: `${actorId}@test.local` } },
    async () => await fn(),
  );
}

describe('audit stamping (A2)', () => {
  it('stamps createdById + updatedById on an audited write, attributed to the actor', async () => {
    const { data } = await registerTenant();
    const adminId = data.user.id;
    const storeId = data.user.storeId;

    // Create as the owner → both stamps are the owner.
    const cat = await asActor(adminId, () =>
      prisma.menuCategory.create({ data: { storeId, name: `Cat ${uid()}` } }),
    );
    expect(cat.createdById).toBe(adminId);
    expect(cat.updatedById).toBe(adminId);

    // Edit as a different actor → createdById is preserved, updatedById moves.
    const updated = await asActor('operator-9', () =>
      prisma.menuCategory.update({ where: { id: cat.id }, data: { name: 'Renamed' } }),
    );
    expect(updated.createdById).toBe(adminId);
    expect(updated.updatedById).toBe('operator-9');
  });

  it('leaves stamps null when there is no actor in the request context', async () => {
    const { data } = await registerTenant();
    const cat = await prisma.menuCategory.create({
      data: { storeId: data.user.storeId, name: `Cat ${uid()}` },
    });
    expect(cat.createdById).toBeNull();
    expect(cat.updatedById).toBeNull();
  });

  it('does not stamp non-audited models (e.g. an order line ledger has no actor columns)', async () => {
    // A write to a non-audited model inside an actor context must not throw —
    // the extension simply passes it through untouched.
    const { data } = await registerTenant();
    await expect(
      asActor(data.user.id, () => prisma.idempotencyKey.create({ data: { key: `k_${uid()}` } })),
    ).resolves.toBeTruthy();
  });
});

describe('soft delete (A3)', () => {
  it('soft-deletes (keeps the row, hides it, attributes it) and restores', async () => {
    const { data } = await registerTenant();
    const adminId = data.user.id;
    const cat = await asActor(adminId, () =>
      prisma.menuCategory.create({ data: { storeId: data.user.storeId, name: `Cat ${uid()}` } }),
    );

    // delete → soft delete: hidden from normal reads...
    await asActor(adminId, () => prisma.menuCategory.delete({ where: { id: cat.id } }));
    expect(await prisma.menuCategory.findUnique({ where: { id: cat.id } })).toBeNull();
    expect(await prisma.menuCategory.count({ where: { id: cat.id } })).toBe(0);

    // ...but the row is kept, with the delete attributed to the actor.
    const raw = await withDeleted(() => prisma.menuCategory.findUnique({ where: { id: cat.id } }));
    expect(raw?.deletedAt).not.toBeNull();
    expect(raw?.deletedById).toBe(adminId);

    // restore → visible again.
    await withDeleted(() =>
      prisma.menuCategory.update({
        where: { id: cat.id },
        data: { deletedAt: null, deletedById: null },
      }),
    );
    expect(await prisma.menuCategory.findUnique({ where: { id: cat.id } })).not.toBeNull();
  });

  it('removes a soft-deleted menu item from the customer menu (nested include)', async () => {
    const { data } = await registerTenant();
    const storeId = data.user.storeId;
    const table = await prisma.table.findFirst({ where: { storeId } });
    const item = await prisma.menuItem.findFirst({
      where: { storeId, isAvailable: true, posOnly: false },
    });
    expect(table && item).toBeTruthy();

    const menuItemIds = async () => {
      const res = await api().get(`/public/menu?tableCode=${table!.code}`);
      return (res.body.data.categories as Array<{ items: Array<{ id: string }> }>)
        .flatMap((c) => c.items)
        .map((i) => i.id);
    };

    expect(await menuItemIds()).toContain(item!.id);
    await asActor(data.user.id, () => prisma.menuItem.delete({ where: { id: item!.id } }));
    expect(await menuItemIds()).not.toContain(item!.id);
  });

  it('records an AuditLog row when an audited model is soft-deleted', async () => {
    const { data } = await registerTenant();
    const adminId = data.user.id;
    const cat = await asActor(adminId, () =>
      prisma.menuCategory.create({ data: { storeId: data.user.storeId, name: `Cat ${uid()}` } }),
    );
    await asActor(adminId, () => prisma.menuCategory.delete({ where: { id: cat.id } }));

    const rows = await prisma.auditLog.findMany({
      where: { action: 'menuCategory.delete', entityId: cat.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].actorId).toBe(adminId);
    expect(rows[0].entity).toBe('MenuCategory');
  });
});
