import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

import { requestContext } from '../lib/requestContext';
import { logger } from '../lib/logger';
import { httpRequestDuration } from '../lib/metrics';

// Health/metrics endpoints are high-frequency and noisy — don't log them.
const QUIET_PATHS = new Set(['/health', '/health/live', '/health/ready', '/metrics']);

/**
 * Assigns a request id (honouring an inbound X-Request-Id), runs the request
 * inside the request-context ALS so every log line correlates, echoes the id on
 * the response, logs completion, and records the HTTP duration metric.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const inbound = req.header('x-request-id');
  const requestId = inbound && inbound.length <= 200 ? inbound : randomUUID();
  res.setHeader('x-request-id', requestId);

  const start = process.hrtime.bigint();

  requestContext.run({ requestId, ip: req.ip }, () => {
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      // Use the matched route pattern (low-cardinality) for the metric label.
      const route = req.route?.path
        ? (req.baseUrl || '') + req.route.path
        : req.baseUrl || 'unmatched';
      httpRequestDuration.observe(
        { method: req.method, route, status: String(res.statusCode) },
        durationMs / 1000,
      );
      if (!QUIET_PATHS.has(req.path)) {
        // requestId passed explicitly (the finish event may run outside the ALS).
        logger.info(
          {
            requestId,
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            durationMs: Math.round(durationMs),
          },
          'request',
        );
      }
    });
    next();
  });
}
