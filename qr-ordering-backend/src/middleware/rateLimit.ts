import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

import { config } from '../config/env';

// 429 response that matches the app's standard error envelope.
function rateLimited(_req: Request, res: Response) {
  res.status(429).json({
    success: false,
    error: {
      message: 'Too many requests — please slow down and try again shortly.',
      code: 'RATE_LIMITED',
    },
  });
}

const common = {
  standardHeaders: true as const,
  legacyHeaders: false as const,
  handler: rateLimited,
  // Don't throttle the integration-test suite.
  skip: () => config.nodeEnv === 'test',
};

// Broad flood backstop for the whole API (per IP). Deliberately generous so a
// multi-device restaurant behind one NAT IP doing 5s polling is never throttled
// in normal use — the tighter auth/order limiters below do the real work.
export const generalLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 1200 });

// Brute-force guard on login. Only FAILED logins count toward the limit, so a
// busy-but-legit login flow is never blocked; per-account lockout (auth.service)
// is the second layer.
export const loginLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60_000,
  limit: 20,
  skipSuccessfulRequests: true,
});

// Caps order-submission floods (per IP) — well above any real POS / customer rate.
export const orderLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 60 });

// Throttle override-PIN verification per IP. It returns 200 even for a WRONG PIN,
// so a plain count (not skip-successful) is what blocks brute-forcing the 4-6
// digit PIN. Generous enough for legitimate staff overrides behind one NAT.
export const pinVerifyLimiter = rateLimit({ ...common, windowMs: 15 * 60_000, limit: 60 });
