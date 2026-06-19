import type { Response } from 'express';

/**
 * Standard API error. Throw this anywhere in a route handler and the central
 * error middleware will turn it into a JSON error response.
 */
export class ApiError extends Error {
  statusCode: number;
  code?: string;
  details?: unknown;

  constructor(statusCode: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, message, 'BAD_REQUEST', details);
  }
  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message, 'UNAUTHORIZED');
  }
  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message, 'FORBIDDEN');
  }
  static notFound(message = 'Not found') {
    return new ApiError(404, message, 'NOT_FOUND');
  }
  static conflict(message: string) {
    return new ApiError(409, message, 'CONFLICT');
  }
  static locked(message = 'Locked') {
    return new ApiError(423, message, 'LOCKED');
  }
  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(429, message, 'RATE_LIMITED');
  }
}

export function sendOk<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function sendCreated<T>(res: Response, data: T) {
  return res.status(201).json({ success: true, data });
}
