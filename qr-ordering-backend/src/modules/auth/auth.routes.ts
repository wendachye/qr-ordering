import { Router } from 'express';

import { sendOk } from '../../lib/response';
import { requireAdmin } from '../../middleware/auth';
import { loginLimiter } from '../../middleware/rateLimit';
import { loginSchema, passwordVerifySchema } from '../../validators/auth';
import { getProfile, login, verifyPassword } from './auth.service';

export const authRouter = Router();

// POST /api/admin/auth/login
authRouter.post('/login', loginLimiter, async (req, res) => {
  sendOk(res, await login(loginSchema.parse(req.body)));
});

// GET /api/admin/auth/me
authRouter.get('/me', requireAdmin, async (req, res) => {
  sendOk(res, await getProfile(req.admin!.id, req.admin!.isPlatformAdmin, req.admin!.imp));
});

// POST /api/admin/auth/verify-password — re-confirm the admin's password.
authRouter.post('/verify-password', requireAdmin, async (req, res) => {
  const { password } = passwordVerifySchema.parse(req.body);
  sendOk(res, await verifyPassword(req.admin!.id, password));
});
