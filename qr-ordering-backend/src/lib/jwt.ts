import jwt, { type SignOptions } from 'jsonwebtoken';

import { config } from '../config/env';

export interface AdminTokenPayload {
  sub: string; // admin user id
  email: string;
  storeId: string; // tenant this admin belongs to
  isPlatformAdmin?: boolean; // platform super-admin (edits global Plan configs)
  imp?: string; // set on an impersonation token: the operator's email (audit)
}

export function signAdminToken(payload: AdminTokenPayload, opts?: { expiresIn?: string }): string {
  const options: SignOptions = {
    expiresIn: (opts?.expiresIn ?? config.jwtExpiresIn) as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, config.jwtSecret, options);
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  const decoded = jwt.verify(token, config.jwtSecret);
  if (typeof decoded === 'string' || !decoded.storeId) {
    throw new Error('Invalid token payload');
  }
  return {
    sub: String(decoded.sub),
    email: String(decoded.email),
    storeId: String(decoded.storeId),
    isPlatformAdmin: decoded.isPlatformAdmin === true,
    imp: typeof decoded.imp === 'string' ? decoded.imp : undefined,
  };
}
