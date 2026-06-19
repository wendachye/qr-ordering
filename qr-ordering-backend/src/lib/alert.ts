import { config } from '../config/env';
import { logger } from './logger';

export interface OpsAlert {
  level: 'warn' | 'error';
  event: string;
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Surface an operational alert. Always logs; additionally POSTs to a webhook
 * (Slack / PagerDuty / etc.) when ALERT_WEBHOOK_URL is set. Never throws —
 * alerting must not break the code path that triggered it.
 */
export async function notifyOps(alert: OpsAlert): Promise<void> {
  logger[alert.level === 'error' ? 'error' : 'warn'](
    { event: alert.event, context: alert.context },
    `ALERT: ${alert.message}`,
  );

  const url = config.alertWebhookUrl;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...alert, ts: new Date().toISOString() }),
    });
  } catch (err) {
    logger.error({ err }, 'alert webhook delivery failed');
  }
}
