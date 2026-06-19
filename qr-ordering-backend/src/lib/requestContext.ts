import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  ip?: string;
  // Set by requireAdmin once the JWT is verified — who is acting (and the
  // operator behind an impersonation token), for audit attribution.
  actor?: { id: string; email: string; imp?: string };
}

// Per-request context so logs + the audit log can correlate to a single request
// without threading ids through every function.
export const requestContext = new AsyncLocalStorage<RequestContext>();

export function currentRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

export function currentIp(): string | undefined {
  return requestContext.getStore()?.ip;
}

export function currentActor(): RequestContext['actor'] | undefined {
  return requestContext.getStore()?.actor;
}
