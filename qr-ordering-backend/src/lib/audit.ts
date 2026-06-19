import { Prisma } from '@prisma/client';

import { prisma } from './prisma';
import { logger } from './logger';
import { currentActor, currentIp, currentRequestId } from './requestContext';

export interface AuditInput {
  action: string; // e.g. 'client.create', 'plan.update', 'outlet.impersonate'
  entity: string; // 'Client' | 'Plan' | 'Store'
  entityId?: string | null;
  storeId?: string | null; // affected outlet, when applicable
  summary?: string | null;
  metadata?: unknown; // before/after diff or extra detail (JSON)
}

/**
 * Append a row to the operator audit log. Best-effort: a failure is logged but
 * never propagated, so auditing can't break the request it's recording. Actor /
 * request id / ip are read from the request-context ALS (set by requireAdmin +
 * requestLogger), so callers only pass what the action is about.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  const actor = currentActor();
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? 'system',
        actorImp: actor?.imp ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        storeId: input.storeId ?? null,
        summary: input.summary ?? null,
        metadata:
          input.metadata === undefined || input.metadata === null
            ? undefined
            : (input.metadata as Prisma.InputJsonValue),
        requestId: currentRequestId() ?? null,
        ip: currentIp() ?? null,
      },
    });
  } catch (err) {
    logger.warn({ err, action: input.action }, 'audit write failed');
  }
}
