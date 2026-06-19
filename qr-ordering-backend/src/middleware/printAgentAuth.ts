import type { NextFunction, Request, Response } from 'express';

import { ApiError } from '../lib/response';
import { config } from '../config/env';

/**
 * Protects the print-agent routes. The local print agent must send the shared
 * secret in the `x-print-agent-key` header.
 */
export function requirePrintAgent(req: Request, _res: Response, next: NextFunction) {
  const key = req.header('x-print-agent-key');
  if (!key || key !== config.printAgentApiKey) {
    throw ApiError.unauthorized('Invalid print agent key');
  }
  next();
}
