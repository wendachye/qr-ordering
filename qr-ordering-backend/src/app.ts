import { timingSafeEqual } from 'node:crypto';

import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { config } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { checkReadiness } from './lib/health';
import { registry } from './lib/metrics';
import { errorHandler, notFoundHandler } from './middleware/error';
import { UPLOADS_DIR, UPLOADS_ROUTE, ensureUploadsDir } from './lib/uploads';
import { apiRouter } from './routes';
import { stripeWebhook } from './modules/billing/billing.webhook';

export function createApp() {
  const app = express();

  // Behind a managed-cloud load balancer: trust the first proxy hop so rate
  // limiting + req.ip see the real client address (not the LB's).
  app.set('trust proxy', 1);

  // Request id + structured request logging + HTTP metrics (wraps everything).
  app.use(requestLogger);

  // Security headers. Allow item images under /uploads to be loaded by the
  // separate-origin customer/admin apps (CORS handles the JSON API).
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  app.use(
    cors({
      origin: config.corsOrigin,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-print-agent-key', 'Idempotency-Key'],
    }),
  );

  // Stripe webhook needs the raw (unparsed) body for signature verification,
  // so it is mounted before express.json.
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

  app.use(express.json({ limit: '1mb' }));

  // Serve uploaded item images from disk — local storage only. With S3, images
  // are served from the bucket/CDN, and an S3 deployment must never touch the
  // (often read-only / non-writable) container filesystem at boot.
  if (config.storage.driver === 'local') {
    ensureUploadsDir();
    app.use(UPLOADS_ROUTE, express.static(UPLOADS_DIR));
  }

  // Liveness — the process is up (no dependency checks; for restart probes).
  const liveness = (_req: Request, res: Response) =>
    res.json({ success: true, data: { status: 'ok' } });
  app.get('/health', liveness);
  app.get('/health/live', liveness);

  // Readiness — safe to receive traffic (DB reachable + not draining). The LB
  // routes only to instances returning 200 here.
  app.get('/health/ready', async (_req, res) => {
    const r = await checkReadiness();
    res.status(r.ready ? 200 : 503).json({ success: r.ready, data: r });
  });

  // Prometheus metrics. Gated by METRICS_TOKEN when set (also restrict via network).
  app.get('/metrics', async (req, res) => {
    if (config.metricsToken) {
      const auth = req.header('authorization');
      const provided = auth?.startsWith('Bearer ')
        ? auth.slice('Bearer '.length)
        : (req.header('x-metrics-token') ?? '');
      const a = Buffer.from(provided);
      const b = Buffer.from(config.metricsToken);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        res.status(401).end();
        return;
      }
    }
    res.setHeader('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });

  // All feature APIs (public, orders, admin/*, print-agent) + their per-IP
  // rate-limit backstop live in the central route table.
  app.use(apiRouter);

  // 404 + central error handler (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
