import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

// Prometheus registry exposed at /metrics. Default metrics cover process/Node
// health (event loop, heap, GC); the rest are app-specific.
export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [registry],
});

export const ordersPlacedTotal = new Counter({
  name: 'orders_placed_total',
  help: 'Orders successfully created',
  registers: [registry],
});

export const printJobFailuresTotal = new Counter({
  name: 'print_job_failures_total',
  help: 'Print jobs that exhausted retries (terminal failures)',
  registers: [registry],
});
