import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  ip?: string;
  // Set by requireAdmin once the JWT is verified — who is acting (and the
  // operator behind an impersonation token), for audit attribution.
  actor?: { id: string; email: string; imp?: string };
  // When true, soft-delete-aware reads include soft-deleted rows (Trash views,
  // restore, reporting). Default/absent = hide soft-deleted rows.
  includeDeleted?: boolean;
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

export function includeDeletedActive(): boolean {
  return requestContext.getStore()?.includeDeleted === true;
}

/**
 * Run `fn` with soft-deleted rows visible to audited-model reads (Trash /
 * restore / reporting). Reuses the current context so actor + request id are
 * preserved; awaits inside the run so the flag is live for the (lazy) queries.
 */
export function withDeleted<T>(fn: () => Promise<T>): Promise<T> {
  const store = requestContext.getStore();
  const next: RequestContext = store
    ? { ...store, includeDeleted: true }
    : { requestId: 'system', includeDeleted: true };
  return requestContext.run(next, async () => await fn());
}
