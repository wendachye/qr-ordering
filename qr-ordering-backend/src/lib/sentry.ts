import * as Sentry from '@sentry/node';

import { config } from '../config/env';
import { logger } from './logger';

let enabled = false;

/** Initialise Sentry error tracking when SENTRY_DSN is set (no-op otherwise). */
export function initSentry(): void {
  if (!config.sentryDsn) return;
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    tracesSampleRate: 0, // error capture only — no performance tracing
  });
  enabled = true;
  logger.info('Sentry error tracking enabled');
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

export async function flushSentry(ms = 2000): Promise<void> {
  if (enabled) await Sentry.flush(ms);
}
