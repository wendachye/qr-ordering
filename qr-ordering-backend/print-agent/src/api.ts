import path from 'node:path';

import dotenv from 'dotenv';

import type { KitchenPayload } from './formatter';

// Load the print-agent's own .env (print-agent/.env), regardless of cwd.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const agentConfig = {
  apiBaseUrl: (process.env.API_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, ''),
  apiKey: process.env.PRINT_AGENT_API_KEY ?? 'secret-key',
  printerIp: process.env.PRINTER_IP ?? '192.168.1.50',
  printerPort: Number(process.env.PRINTER_PORT ?? 9100),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 2000),
  // When true, the agent prints the ticket to the console instead of sending it
  // to a physical printer. Handy for testing the flow without hardware.
  dryRun: process.env.PRINTER_DRY_RUN === 'true',
};

export interface PrintJob {
  id: string;
  orderId: string;
  status: string;
  payload: KitchenPayload;
  retryCount: number;
  createdAt: string;
}

async function request<T>(method: string, pathname: string, body?: unknown): Promise<T> {
  const res = await fetch(`${agentConfig.apiBaseUrl}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-print-agent-key': agentConfig.apiKey,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    error?: { message?: string };
  };

  if (!res.ok || json.success === false) {
    throw new Error(json.error?.message ?? `Request failed with status ${res.status}`);
  }
  return json.data as T;
}

export function fetchPendingJobs(): Promise<PrintJob[]> {
  return request<PrintJob[]>('GET', '/api/v1/print-agent/jobs/pending');
}

export function markPrinting(id: string): Promise<{ claimed: boolean }> {
  return request<{ claimed: boolean }>('POST', `/api/v1/print-agent/jobs/${id}/mark-printing`);
}

export function markPrinted(id: string): Promise<unknown> {
  return request('POST', `/api/v1/print-agent/jobs/${id}/mark-printed`);
}

export function markFailed(id: string, error: string): Promise<unknown> {
  return request('POST', `/api/v1/print-agent/jobs/${id}/mark-failed`, { error });
}
