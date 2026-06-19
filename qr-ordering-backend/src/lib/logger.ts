import pino from 'pino';

import { config } from '../config/env';
import { requestContext } from './requestContext';
import { tenantStore } from './tenant';

/**
 * Structured JSON logger. Every line automatically carries the active requestId
 * and storeId (via the mixin), so logs across a request/tenant correlate without
 * manual threading. Sensitive fields are redacted as a safety net.
 */
export const logger = pino({
  level: config.logLevel,
  base: { service: 'qr-ordering-backend', env: config.nodeEnv },
  serializers: { err: pino.stdSerializers.err },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-print-agent-key"]',
      'password',
      '*.password',
    ],
    censor: '[redacted]',
  },
  mixin() {
    const requestId = requestContext.getStore()?.requestId;
    const storeId = tenantStore.getStore()?.storeId;
    return {
      ...(requestId ? { requestId } : {}),
      ...(storeId ? { storeId } : {}),
    };
  },
});
