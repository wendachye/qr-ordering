import { Router } from 'express';
import type { Request, Response } from 'express';

import { verifyAdminToken } from '../../lib/jwt';
import { floorEvents } from '../../lib/floorEvents';

export const adminRealtimeRouter = Router();

// GET /api/admin/realtime/floor — Server-Sent Events stream of floor changes.
// The browser EventSource can't set an Authorization header, so the JWT arrives
// via ?token= (with a Bearer-header fallback for non-browser clients). This is a
// read-only "something changed, refetch" signal — it carries no data and is not
// subscription-gated (the REST floor fetch the client makes still is).
adminRealtimeRouter.get('/floor', (req: Request, res: Response) => {
  const headerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice('Bearer '.length)
    : '';
  const token = (typeof req.query.token === 'string' ? req.query.token : '') || headerToken;

  let storeId: string;
  try {
    storeId = verifyAdminToken(token).storeId;
  } catch {
    res.status(401).end();
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Stop a reverse proxy (nginx) from buffering the stream.
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n'); // client reconnect backoff hint
  res.write(': connected\n\n');

  const send = () => res.write('event: floor\ndata: {}\n\n');
  const unsubscribe = floorEvents.subscribe(storeId, send);

  // Heartbeat so idle connections aren't dropped by proxies / load balancers.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});
