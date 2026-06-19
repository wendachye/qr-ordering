import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

import { ApiError } from '../lib/response';
import { config } from '../config/env';
import { logger } from '../lib/logger';
import { captureError } from '../lib/sentry';
import { currentRequestId } from '../lib/requestContext';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: { message: 'Route not found', code: 'NOT_FOUND' },
  });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: err.flatten(),
      },
    });
  }

  // Our own typed errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { message: err.message, code: err.code, details: err.details },
    });
  }

  // Multer upload errors (e.g. file too large)
  if (err && typeof err === 'object' && (err as { name?: string }).name === 'MulterError') {
    const e = err as { message?: string; code?: string };
    const message =
      e.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 5MB)' : (e.message ?? 'Upload error');
    return res.status(400).json({
      success: false,
      error: { message, code: e.code ?? 'UPLOAD_ERROR' },
    });
  }

  // Known Prisma errors → friendly messages
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: { message: 'A record with this value already exists', code: 'CONFLICT' },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: { message: 'Record not found', code: 'NOT_FOUND' },
      });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({
        success: false,
        error: {
          message: 'This record is referenced by other records and cannot be changed',
          code: 'FK_CONSTRAINT',
        },
      });
    }
  }

  // Unexpected — log with full context + report to Sentry.
  logger.error({ err }, 'unhandled error');
  captureError(err);
  return res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      requestId: currentRequestId(),
      ...(config.isProduction ? {} : { details: String(err) }),
    },
  });
}
