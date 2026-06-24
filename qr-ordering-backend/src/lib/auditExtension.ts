import { Prisma, PrismaClient } from '@prisma/client';

import { currentActor, currentIp, currentRequestId, includeDeletedActive } from './requestContext';

// Independently-managed catalog / config / identity entities that carry the
// audit-attribution + soft-delete columns. Writes get createdById/updatedById
// stamped; deletes become soft (deletedAt); reads hide soft-deleted rows.
// NOTE: the product deactivates records (isActive) rather than deleting them, so
// the delete→soft path is a DORMANT safety net — audit attribution (who
// created/updated) is the live value here.
//
// Deliberately EXCLUDED: the tightly-owned, full-replace children
// (OptionGroup/OptionChoice/ComboGroup/ComboOption). The app rebuilds those by
// delete-all-and-recreate, and Prisma query extensions can't filter nested
// `include` reads — so soft-deleting them would leave stale rows visible via the
// parent. They hard-delete instead (an order snapshots its options as JSON, so
// nothing references those rows). Orders, payments, ledgers, invoices, ephemeral
// rows, and the audit log itself are untouched too.
const AUDITED_MODELS = new Set<string>([
  'Store',
  'Client',
  'AdminUser',
  'MenuCategory',
  'MenuItem',
  'Combo',
  'Table',
  'Voucher',
  'Member',
  'RewardCatalog',
]);

type Data = Record<string, unknown>;
type Where = Record<string, unknown>;
// Loose view of the per-operation args we touch (data / where / create / update).
type Args = { data?: unknown; where?: Where; create?: unknown; update?: unknown };

// Map a model name ("MenuItem") to its client delegate key ("menuItem").
function delegateKey(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

type SoftDeleteDelegate = {
  update: (args: { where?: Where; data: Data }) => Promise<unknown>;
  updateMany: (args: { where?: Where; data: Data }) => Promise<unknown>;
};
function delegate(client: PrismaClient, model: string): SoftDeleteDelegate {
  return (client as unknown as Record<string, SoftDeleteDelegate>)[delegateKey(model)];
}

// Stamp the creator + last-writer, without clobbering an explicitly-provided id.
function withCreatedBy(data: Data, actorId: string): Data {
  return {
    ...data,
    createdById: data.createdById ?? actorId,
    updatedById: data.updatedById ?? actorId,
  };
}
function withUpdatedBy(data: Data, actorId: string): Data {
  return { ...data, updatedById: data.updatedById ?? actorId };
}

// The patch a soft delete applies in place of a hard delete.
function softDeletePatch(): Data {
  const actor = currentActor();
  return {
    deletedAt: new Date(),
    deletedById: actor?.id ?? null,
    deletedByImp: actor?.imp ?? null,
  };
}

// Add `deletedAt: null` to a read's where unless the caller is in includeDeleted
// mode or already constrains deletedAt explicitly (e.g. a Trash query).
function hideDeleted(where: Where | undefined): Where {
  const w = where ?? {};
  if ('deletedAt' in w) return w;
  return { ...w, deletedAt: null };
}

type AuditWriter = { auditLog: { createMany: (a: { data: Data[] }) => Promise<unknown> } };

// Best-effort AuditLog rows for a soft delete, written via the base client so we
// avoid the prisma.ts -> auditExtension circular import (and the audit-log write
// itself isn't audited). A failure here must never break the delete.
async function recordDeleteAudit(
  client: PrismaClient,
  model: string,
  entries: Data[],
): Promise<void> {
  const actor = currentActor();
  const base: Data = {
    actorId: actor?.id ?? null,
    actorEmail: actor?.email ?? 'system',
    actorImp: actor?.imp ?? null,
    entity: model,
    requestId: currentRequestId() ?? null,
    ip: currentIp() ?? null,
  };
  try {
    await (client as unknown as AuditWriter).auditLog.createMany({
      data: entries.map((e) => ({ ...base, ...e })),
    });
  } catch {
    // best-effort — auditing must never break the delete
  }
}

/**
 * Audit attribution + soft delete for the audited models, as a Prisma client
 * extension. Built as a factory because the soft-delete re-dispatch (turning a
 * hard `delete` into an `update` that sets `deletedAt`) needs a client handle.
 *
 * - create/createMany/update/updateMany/upsert → stamp createdById/updatedById
 *   from the request-context actor (A2). No actor (seeds, public order flow) =
 *   no stamp.
 * - delete/deleteMany → rewritten to set deletedAt/deletedById/deletedByImp (A3);
 *   the row is kept, so history/references survive and it's recoverable.
 * - findMany/findFirst(OrThrow)/count/aggregate/groupBy → inject deletedAt: null;
 *   findUnique(OrThrow) → post-filter the result (a unique where can't take the
 *   filter). `withDeleted()` (ALS flag) reveals soft-deleted rows.
 *
 * Only top-level writes are stamped, and a parent soft delete does NOT cascade
 * to children (they become unreachable via the hidden parent) — both documented
 * limitations in the plan.
 */
export function makeAuditExtension(client: PrismaClient) {
  return Prisma.defineExtension({
    name: 'auditSoftDelete',
    query: {
      $allModels: {
        // ---- A2: attribution stamps ----
        async create({ model, args, query }) {
          const actorId = currentActor()?.id;
          if (actorId && AUDITED_MODELS.has(model) && (args as Args).data) {
            (args as Args).data = withCreatedBy((args as Args).data as Data, actorId);
          }
          return query(args);
        },
        async createMany({ model, args, query }) {
          const actorId = currentActor()?.id;
          const data = (args as Args).data;
          if (actorId && AUDITED_MODELS.has(model) && data) {
            (args as Args).data = Array.isArray(data)
              ? data.map((d) => withCreatedBy(d as Data, actorId))
              : withCreatedBy(data as Data, actorId);
          }
          return query(args);
        },
        async update({ model, args, query }) {
          const actorId = currentActor()?.id;
          if (actorId && AUDITED_MODELS.has(model) && (args as Args).data) {
            (args as Args).data = withUpdatedBy((args as Args).data as Data, actorId);
          }
          return query(args);
        },
        async updateMany({ model, args, query }) {
          const actorId = currentActor()?.id;
          if (actorId && AUDITED_MODELS.has(model) && (args as Args).data) {
            (args as Args).data = withUpdatedBy((args as Args).data as Data, actorId);
          }
          return query(args);
        },
        async upsert({ model, args, query }) {
          const actorId = currentActor()?.id;
          if (actorId && AUDITED_MODELS.has(model)) {
            if ((args as Args).create) {
              (args as Args).create = withCreatedBy((args as Args).create as Data, actorId);
            }
            if ((args as Args).update) {
              (args as Args).update = withUpdatedBy((args as Args).update as Data, actorId);
            }
          }
          return query(args);
        },

        // ---- A3: soft delete (hard delete → set deletedAt), + an AuditLog row ----
        async delete({ model, args, query }) {
          if (!AUDITED_MODELS.has(model)) return query(args);
          const row = (await delegate(client, model).update({
            where: (args as Args).where,
            data: softDeletePatch(),
          })) as { id: string; storeId?: string | null };
          await recordDeleteAudit(client, model, [
            {
              action: `${delegateKey(model)}.delete`,
              entityId: row.id,
              storeId: row.storeId ?? (model === 'Store' ? row.id : null),
            },
          ]);
          return row;
        },
        async deleteMany({ model, args, query }) {
          if (!AUDITED_MODELS.has(model)) return query(args);
          const result = (await delegate(client, model).updateMany({
            where: (args as Args).where,
            data: softDeletePatch(),
          })) as { count: number };
          if (result.count > 0) {
            await recordDeleteAudit(client, model, [
              {
                action: `${delegateKey(model)}.deleteMany`,
                entityId: null,
                storeId: null,
                summary: `${result.count} row(s) soft-deleted`,
              },
            ]);
          }
          return result;
        },

        // ---- A3: hide soft-deleted rows from reads ----
        async findMany({ model, args, query }) {
          if (AUDITED_MODELS.has(model) && !includeDeletedActive()) {
            (args as Args).where = hideDeleted((args as Args).where);
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (AUDITED_MODELS.has(model) && !includeDeletedActive()) {
            (args as Args).where = hideDeleted((args as Args).where);
          }
          return query(args);
        },
        async findFirstOrThrow({ model, args, query }) {
          if (AUDITED_MODELS.has(model) && !includeDeletedActive()) {
            (args as Args).where = hideDeleted((args as Args).where);
          }
          return query(args);
        },
        async count({ model, args, query }) {
          if (AUDITED_MODELS.has(model) && !includeDeletedActive()) {
            (args as Args).where = hideDeleted((args as Args).where);
          }
          return query(args);
        },
        async aggregate({ model, args, query }) {
          if (AUDITED_MODELS.has(model) && !includeDeletedActive()) {
            (args as Args).where = hideDeleted((args as Args).where);
          }
          return query(args);
        },
        async groupBy({ model, args, query }) {
          if (AUDITED_MODELS.has(model) && !includeDeletedActive()) {
            (args as Args).where = hideDeleted((args as Args).where);
          }
          return query(args);
        },
        // A unique where can't carry the deletedAt filter, so post-filter instead.
        async findUnique({ model, args, query }) {
          const result = await query(args);
          if (
            result &&
            AUDITED_MODELS.has(model) &&
            !includeDeletedActive() &&
            (result as { deletedAt?: unknown }).deletedAt != null
          ) {
            return null;
          }
          return result;
        },
        async findUniqueOrThrow({ model, args, query }) {
          const result = await query(args);
          if (
            result &&
            AUDITED_MODELS.has(model) &&
            !includeDeletedActive() &&
            (result as { deletedAt?: unknown }).deletedAt != null
          ) {
            throw new Prisma.PrismaClientKnownRequestError(
              `No ${model} found (soft-deleted)`,
              { code: 'P2025', clientVersion: Prisma.prismaVersion.client },
            );
          }
          return result;
        },
      },
    },
  });
}
