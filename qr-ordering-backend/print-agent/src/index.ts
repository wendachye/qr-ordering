import {
  agentConfig,
  fetchPendingJobs,
  markFailed,
  markPrinted,
  markPrinting,
  type PrintJob,
} from './api';
import { formatKitchenTicket, renderTicketText } from './formatter';
import { printToLanPrinter } from './printer';
import { log, logError, sleep } from './utils';

async function processJob(job: PrintJob): Promise<void> {
  // Atomically claim the job; if another agent already took it, skip (no dupe).
  const claim = await markPrinting(job.id);
  if (!claim.claimed) {
    log(`Job ${job.id} already claimed by another agent — skipping`);
    return;
  }
  log(`Job ${job.id} (order #${job.payload?.orderNumber}) → PRINTING`);

  if (agentConfig.dryRun) {
    console.log(
      `\n----- DRY RUN: kitchen ticket for order #${job.payload?.orderNumber} -----\n` +
        `${renderTicketText(job.payload)}\n` +
        `------------------------------------------------------\n`,
    );
  } else {
    const buffer = formatKitchenTicket(job.payload);
    await printToLanPrinter(agentConfig.printerIp, agentConfig.printerPort, buffer);
  }

  await markPrinted(job.id);
  log(`Job ${job.id} PRINTED ✓`);
}

async function tick(): Promise<void> {
  const jobs = await fetchPendingJobs();
  if (jobs.length > 0) log(`Found ${jobs.length} pending job(s)`);

  for (const job of jobs) {
    try {
      await processJob(job);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError(`Job ${job.id} failed: ${message}`);
      try {
        await markFailed(job.id, message);
      } catch (markErr) {
        logError(`Could not mark job ${job.id} as failed: ${String(markErr)}`);
      }
    }
  }
}

async function main(): Promise<void> {
  log('Print agent started.');
  log(`  API:     ${agentConfig.apiBaseUrl}`);
  log(
    `  Printer: ${agentConfig.printerIp}:${agentConfig.printerPort}${agentConfig.dryRun ? '  (DRY RUN)' : ''}`,
  );
  log(`  Poll:    every ${agentConfig.pollIntervalMs}ms`);

  let running = true;
  const stop = (sig: string) => {
    log(`${sig} received, stopping after current cycle...`);
    running = false;
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));

  while (running) {
    try {
      await tick();
    } catch (err) {
      // Network/backend errors shouldn't crash the agent — log and retry.
      logError(`Poll error: ${err instanceof Error ? err.message : String(err)}`);
    }
    await sleep(agentConfig.pollIntervalMs);
  }

  log('Print agent stopped.');
  process.exit(0);
}

void main();
