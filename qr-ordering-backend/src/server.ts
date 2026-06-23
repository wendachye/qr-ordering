import { createApp } from './app';
import { config } from './config/env';
import { prisma } from './lib/prisma';
import { setDraining } from './lib/health';
import { logger } from './lib/logger';
import { initSentry, flushSentry, captureError } from './lib/sentry';

/** Wait for the database to accept connections (managed PG can be slow to wake). */
async function waitForDatabase(retries = 10, delayMs = 1500): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (err) {
      logger.warn({ attempt, retries, err }, 'database not ready');
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function start(): Promise<void> {
  initSentry();
  await waitForDatabase();

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(
      { port: config.port },
      'API listening (health: /health/live, ready: /health/ready, metrics: /metrics)',
    );
  });

  let shuttingDown = false;
  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutdown signal received, draining');

    // 1) Fail readiness so the load balancer stops routing new requests to us.
    setDraining();

    // 2) Hard-exit backstop if in-flight requests don't drain in time.
    const force = setTimeout(() => {
      logger.error('graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 10_000);
    force.unref();

    // 3) Give the LB a moment to observe the 503 before we stop accepting.
    if (config.isProduction) await new Promise((r) => setTimeout(r, 3000));

    // 4) Stop accepting connections, let in-flight finish, flush + close.
    server.close(async () => {
      try {
        await flushSentry();
        await prisma.$disconnect();
      } finally {
        clearTimeout(force);
        logger.info('shutdown complete');
        process.exit(0);
      }
    });
    // Long-lived SSE streams (admin floor) never end on their own, so without
    // this server.close()'s callback would wait out the full force-exit backstop
    // (and exit non-zero). Drop idle keep-alives now and force-close the rest
    // (incl. SSE) after a short grace so genuine in-flight requests still finish.
    server.closeIdleConnections();
    setTimeout(() => server.closeAllConnections(), 2000).unref();
  }

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  // Last-resort safety nets so a stray error is captured, never silent.
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'unhandledRejection');
    captureError(reason);
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaughtException — exiting');
    captureError(err);
    process.exit(1);
  });
}

void start().catch((err) => {
  logger.fatal({ err }, 'failed to start');
  process.exit(1);
});
