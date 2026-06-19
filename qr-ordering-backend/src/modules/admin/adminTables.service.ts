import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/response';
import { randomTableCode } from '../../lib/code';
import { compareNatural } from '../../lib/sort';
import { getDefaultStoreId } from '../../lib/store';
import type { CreateTableInput, UpdateTableInput } from '../../validators/table';

async function ensureTable(id: string) {
  const storeId = await getDefaultStoreId();
  const table = await prisma.table.findFirst({ where: { id, storeId } });
  if (!table) throw ApiError.notFound('Table not found');
  return table;
}

export async function listTables() {
  const storeId = await getDefaultStoreId();
  const tables = await prisma.table.findMany({
    where: { storeId },
    orderBy: [{ name: 'asc' }],
    include: { _count: { select: { orders: true } } },
  });
  return tables
    .map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      isActive: t.isActive,
      orderCount: t._count.orders,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }))
    .sort((a, b) => compareNatural(a.name, b.name));
}

export async function createTable(input: CreateTableInput) {
  const storeId = await getDefaultStoreId();
  // Codes are server-minted and globally unique (Table.code is unique storewide
  // and lives in the QR URL), so tenants never collide on a human-typed code.
  // Retry on the astronomically-rare P2002 collision.
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.table.create({
        data: { storeId, name: input.name, code: randomTableCode(), isActive: input.isActive },
      });
    } catch (err) {
      if ((err as { code?: string })?.code === 'P2002' && attempt < 5) continue;
      throw err;
    }
  }
}

export async function updateTable(id: string, input: UpdateTableInput) {
  await ensureTable(id);
  return prisma.table.update({ where: { id }, data: input });
}

export async function deleteTable(id: string) {
  await ensureTable(id);
  // Block deletion if the table has any history (orders or sessions); the FKs
  // are RESTRICT, and we'd rather keep history. Deactivate instead.
  const [orderCount, sessionCount] = await Promise.all([
    prisma.order.count({ where: { tableId: id } }),
    prisma.tableSession.count({ where: { tableId: id } }),
  ]);
  if (orderCount > 0 || sessionCount > 0) {
    throw ApiError.conflict('This table has orders and cannot be deleted. Deactivate it instead.');
  }
  await prisma.table.delete({ where: { id } });
  return { id };
}
