import { describe, it, expect } from 'vitest';

import { api } from '../helpers';

describe('health + metrics', () => {
  it('liveness returns ok', async () => {
    const res = await api().get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('readiness reports DB reachable', async () => {
    const res = await api().get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ ready: true, db: true });
  });

  it('exposes prometheus metrics', async () => {
    const res = await api().get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_request_duration_seconds');
    expect(res.text).toContain('orders_placed_total');
  });

  it('attaches a request id and echoes an inbound one', async () => {
    const generated = await api().get('/health/live');
    expect(generated.headers['x-request-id']).toBeTruthy();
    const echoed = await api().get('/health/live').set('x-request-id', 'corr-abc-123');
    expect(echoed.headers['x-request-id']).toBe('corr-abc-123');
  });
});
