import type { NextFunction, Request, Response } from 'express';

import { ApiError } from '../lib/response';
import { verifyAdminToken } from '../lib/jwt';
import { tenantStore } from '../lib/tenant';
import { requestContext } from '../lib/requestContext';
import { can, type Permission } from '../lib/permissions';

/**
 * Requires a valid admin JWT in the `Authorization: Bearer <token>` header.
 * Attaches `req.admin` and runs the rest of the request inside the tenant
 * context so every downstream query is scoped to this admin's store.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing or invalid Authorization header');
  }

  const token = header.slice('Bearer '.length).trim();
  let payload;
  try {
    payload = verifyAdminToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  req.admin = {
    id: payload.sub,
    email: payload.email,
    storeId: payload.storeId,
    role: payload.role ?? 'OWNER',
    isPlatformAdmin: payload.isPlatformAdmin === true,
    imp: payload.imp,
  };
  // Attach the actor to the request context so the audit log can attribute
  // writes (and the operator behind an impersonation token) without threading.
  const ctx = requestContext.getStore();
  if (ctx) ctx.actor = { id: payload.sub, email: payload.email, imp: payload.imp };
  tenantStore.run({ storeId: payload.storeId }, () => next());
}

/**
 * Requires the admin to be a platform super-admin (the operator who owns the
 * QR-ordering product). Gates the global Plan configuration. Must run AFTER
 * requireAdmin. Intentionally NOT behind requireActiveSubscription — the
 * operator manages plans regardless of any single store's billing.
 */
export function requirePlatformAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.admin?.isPlatformAdmin) {
    throw ApiError.forbidden('Platform super-admin access required');
  }
  next();
}

/**
 * Gate a route on a staff permission (RBAC). Must run AFTER requireAdmin.
 * A platform super-admin (and any impersonation session, which carries the
 * outlet OWNER role) passes through.
 */
export function requirePermission(perm: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const admin = req.admin;
    if (!admin) throw ApiError.unauthorized('Not authenticated');
    if (admin.isPlatformAdmin || can(admin.role, perm)) return next();
    throw ApiError.forbidden('You do not have permission for this action');
  };
}
