import { prisma } from '../../lib/prisma';
import { currentStoreId } from '../../lib/tenant';
import { withDeleted } from '../../lib/requestContext';
import { ApiError } from '../../lib/response';

// Soft-deletable, store-scoped resources a staff member would want to recover.
// (Store/Client/AdminUser are platform/identity concerns, handled elsewhere.)
interface ResourceDef {
  delegate: string; // prisma client delegate key
  label: string;
  nameField: string; // the field to show as the row's display name
}

const RESTORABLE: Record<string, ResourceDef> = {
  'menu-item': { delegate: 'menuItem', label: 'Menu item', nameField: 'name' },
  'menu-category': { delegate: 'menuCategory', label: 'Category', nameField: 'name' },
  combo: { delegate: 'combo', label: 'Set meal', nameField: 'name' },
  table: { delegate: 'table', label: 'Table', nameField: 'name' },
  voucher: { delegate: 'voucher', label: 'Voucher', nameField: 'code' },
  reward: { delegate: 'rewardCatalog', label: 'Reward', nameField: 'name' },
  member: { delegate: 'member', label: 'Member', nameField: 'phone' },
};

type Row = Record<string, unknown>;
type TrashDelegate = {
  findMany: (a: unknown) => Promise<Row[]>;
  findUnique: (a: unknown) => Promise<Row | null>;
  update: (a: unknown) => Promise<unknown>;
};
function del(def: ResourceDef): TrashDelegate {
  return (prisma as unknown as Record<string, TrashDelegate>)[def.delegate];
}

export interface TrashEntry {
  resource: string;
  label: string;
  id: string;
  name: string;
  deletedAt: string;
  deletedById: string | null;
}

/** Every soft-deleted row across the restorable resources for the caller's store. */
export async function listTrash(): Promise<TrashEntry[]> {
  const storeId = currentStoreId();
  return withDeleted(async () => {
    const entries: TrashEntry[] = [];
    for (const [resource, def] of Object.entries(RESTORABLE)) {
      const rows = await del(def).findMany({
        where: { storeId, deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
        take: 100,
      });
      for (const r of rows) {
        entries.push({
          resource,
          label: def.label,
          id: String(r.id),
          name: String(r[def.nameField] ?? r.id),
          deletedAt: (r.deletedAt as Date).toISOString(),
          deletedById: (r.deletedById as string | null) ?? null,
        });
      }
    }
    // Newest deletions first across all resources.
    entries.sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));
    return entries;
  });
}

/**
 * Restore a soft-deleted row (clear deletedAt), tenant-scoped. Because we kept
 * full unique constraints (no identifier reuse), the row's slug/code/etc. was
 * never freed — so a restore can't collide with a live row.
 */
export async function restore(resource: string, id: string): Promise<{ id: string }> {
  const def = RESTORABLE[resource];
  if (!def) throw ApiError.notFound('Unknown resource');
  const storeId = currentStoreId();
  return withDeleted(async () => {
    const row = await del(def).findUnique({ where: { id } });
    if (!row || row.storeId !== storeId) throw ApiError.notFound('Not found');
    if (row.deletedAt) {
      await del(def).update({
        where: { id },
        data: { deletedAt: null, deletedById: null, deletedByImp: null },
      });
    }
    return { id };
  });
}
