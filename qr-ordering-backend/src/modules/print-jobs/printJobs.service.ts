import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/response';
import { config } from '../../config/env';
import { notifyOps } from '../../lib/alert';
import { printJobFailuresTotal } from '../../lib/metrics';
import { getDefaultStoreId } from '../../lib/store';

// Retry tuning (server-side; the agent just prints whatever it is handed).
const MAX_RETRIES = config.printMaxRetries; // give up + alert after this many failures
const RETRY_BACKOFF_MS = 20_000; // wait before re-handing a FAILED job to the agent
const STUCK_PRINTING_MS = 120_000; // reclaim a job stuck in PRINTING this long

/**
 * Jobs the local print agent should attempt now, oldest first:
 *  - PENDING (never attempted)
 *  - FAILED with retries left, after a backoff window
 *  - PRINTING that's been stuck too long (the agent likely crashed mid-print)
 */
export async function getDueJobs() {
  const now = Date.now();
  const jobs = await prisma.printJob.findMany({
    where: {
      OR: [
        { status: 'PENDING' },
        {
          status: 'FAILED',
          retryCount: { lt: MAX_RETRIES },
          updatedAt: { lt: new Date(now - RETRY_BACKOFF_MS) },
        },
        { status: 'PRINTING', updatedAt: { lt: new Date(now - STUCK_PRINTING_MS) } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });
  return jobs.map((j) => ({
    id: j.id,
    orderId: j.orderId,
    status: j.status,
    payload: j.payload,
    retryCount: j.retryCount,
    createdAt: j.createdAt,
  }));
}

async function ensureJob(id: string) {
  const job = await prisma.printJob.findUnique({ where: { id } });
  if (!job) throw ApiError.notFound('Print job not found');
  return job;
}

/**
 * Atomically claim a job for printing. Only transitions a job that is still due
 * (PENDING, a retryable FAILED, or a stuck PRINTING), so if two agents race for
 * the same job exactly one wins (`claimed: true`) and the other skips — no
 * duplicate kitchen ticket.
 */
export async function markPrinting(id: string) {
  const res = await prisma.printJob.updateMany({
    where: {
      id,
      OR: [
        { status: 'PENDING' },
        { status: 'FAILED', retryCount: { lt: MAX_RETRIES } },
        { status: 'PRINTING', updatedAt: { lt: new Date(Date.now() - STUCK_PRINTING_MS) } },
      ],
    },
    data: { status: 'PRINTING' },
  });
  if (res.count === 0) {
    const exists = await prisma.printJob.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw ApiError.notFound('Print job not found');
    return { id, status: 'PRINTING' as const, claimed: false };
  }
  return { id, status: 'PRINTING' as const, claimed: true };
}

export async function markPrinted(id: string) {
  await ensureJob(id);
  const job = await prisma.printJob.update({
    where: { id },
    data: { status: 'PRINTED', printedAt: new Date(), error: null },
  });
  return { id: job.id, status: job.status, printedAt: job.printedAt };
}

export async function markFailed(id: string, error: string) {
  await ensureJob(id);
  const job = await prisma.printJob.update({
    where: { id },
    data: { status: 'FAILED', error, retryCount: { increment: 1 } },
  });

  // Exactly the attempt that reaches the cap → terminal failure → alert ops once.
  // (markPrinting won't re-claim an exhausted job, so retryCount can't exceed MAX.)
  if (job.retryCount === MAX_RETRIES) {
    const order = await prisma.order.findUnique({
      where: { id: job.orderId },
      select: { orderNumber: true, storeId: true, store: { select: { name: true } } },
    });
    await notifyOps({
      level: 'error',
      event: 'print_job_failed',
      message: `Kitchen ticket for order #${order?.orderNumber ?? '?'} failed to print after ${job.retryCount} attempts: ${error}`,
      context: {
        jobId: job.id,
        orderId: job.orderId,
        storeId: order?.storeId,
        store: order?.store?.name,
        retryCount: job.retryCount,
      },
    });
    printJobFailuresTotal.inc();
  }
  return { id: job.id, status: job.status, retryCount: job.retryCount };
}

/** Per-tenant kitchen-printing health, for the admin dashboard + monitoring. */
export async function getPrintHealth() {
  const storeId = await getDefaultStoreId();
  const scope = { order: { storeId } };
  const stuckBefore = new Date(Date.now() - STUCK_PRINTING_MS);

  const [failedTerminal, retrying, pending, stuck, recent] = await Promise.all([
    prisma.printJob.count({
      where: { ...scope, status: 'FAILED', retryCount: { gte: MAX_RETRIES } },
    }),
    prisma.printJob.count({
      where: { ...scope, status: 'FAILED', retryCount: { lt: MAX_RETRIES } },
    }),
    prisma.printJob.count({ where: { ...scope, status: 'PENDING' } }),
    prisma.printJob.count({
      where: { ...scope, status: 'PRINTING', updatedAt: { lt: stuckBefore } },
    }),
    prisma.printJob.findMany({
      where: { ...scope, status: 'FAILED', retryCount: { gte: MAX_RETRIES } },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        error: true,
        retryCount: true,
        updatedAt: true,
        order: { select: { orderNumber: true } },
      },
    }),
  ]);

  return {
    healthy: failedTerminal === 0 && stuck === 0,
    counts: { failedTerminal, retrying, pending, stuck },
    recentFailures: recent.map((j) => ({
      id: j.id,
      orderNumber: j.order.orderNumber,
      error: j.error,
      retryCount: j.retryCount,
      at: j.updatedAt,
    })),
  };
}
