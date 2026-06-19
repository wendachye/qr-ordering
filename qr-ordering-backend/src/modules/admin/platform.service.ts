import { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/response';
import { DEFAULT_PLANS, PLAN_KEYS, listPlanDefs, type PlanKey } from '../../lib/entitlements';
import { writeAudit } from '../../lib/audit';
import type { AuditQuery, UpdatePlanInput } from '../../validators/platform';

// The canonical plans (DB rows over built-in defaults), ascending sortOrder.
export async function listPlans() {
  return listPlanDefs();
}

// Upsert a plan definition: create the row (defaults merged with the patch) on
// first edit, otherwise patch the existing row.
export async function updatePlan(key: string, input: UpdatePlanInput) {
  if (!PLAN_KEYS.includes(key as PlanKey)) throw ApiError.notFound('Unknown plan');
  const def = DEFAULT_PLANS[key as PlanKey];
  const cleanStripe = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);

  const data: Prisma.PlanUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.monthlyPrice !== undefined) data.monthlyPrice = input.monthlyPrice;
  if (input.currency !== undefined) data.currency = input.currency;
  if (input.stripePriceId !== undefined) data.stripePriceId = cleanStripe(input.stripePriceId);
  if (input.features !== undefined)
    data.features = input.features as unknown as Prisma.InputJsonValue;
  if (input.maxTables !== undefined) data.maxTables = input.maxTables;
  if (input.maxMenuItems !== undefined) data.maxMenuItems = input.maxMenuItems;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  await prisma.plan.upsert({
    where: { key },
    update: data,
    create: {
      key,
      name: input.name ?? def.name,
      description: input.description !== undefined ? input.description : def.description,
      monthlyPrice: input.monthlyPrice ?? def.monthlyPrice,
      currency: input.currency ?? def.currency,
      stripePriceId:
        input.stripePriceId !== undefined ? cleanStripe(input.stripePriceId) : def.stripePriceId,
      features: (input.features ?? def.features) as unknown as Prisma.InputJsonValue,
      maxTables: input.maxTables !== undefined ? input.maxTables : def.maxTables,
      maxMenuItems: input.maxMenuItems !== undefined ? input.maxMenuItems : def.maxMenuItems,
      sortOrder: input.sortOrder ?? def.sortOrder,
      isActive: input.isActive ?? def.isActive,
    },
  });
  await writeAudit({ action: 'plan.update', entity: 'Plan', entityId: key, metadata: input });
  return listPlanDefs();
}

// Operator audit log — paginated, newest first, optional filters. Platform-level
// (cross-tenant): intentionally NOT scoped by getDefaultStoreId.
export async function listAuditLog(q: AuditQuery) {
  const where: Prisma.AuditLogWhereInput = {};
  if (q.action) where.action = q.action;
  if (q.entity) where.entity = q.entity;
  if (q.actorId) where.actorId = q.actorId;
  if (q.from || q.to) {
    where.createdAt = {
      ...(q.from ? { gte: new Date(q.from) } : {}),
      ...(q.to ? { lte: new Date(q.to) } : {}),
    };
  }
  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: q.limit,
      skip: q.offset,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { total, limit: q.limit, offset: q.offset, entries };
}
