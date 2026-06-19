import { Router } from 'express';

import { sendOk } from '../../lib/response';
import { requireAdmin } from '../../middleware/auth';
import { loginLimiter, registerLimiter } from '../../middleware/rateLimit';
import { loginSchema, passwordVerifySchema, registerSchema } from '../../validators/auth';
import { getProfile, login, registerStore, verifyPassword } from './auth.service';

export const authRouter = Router();

// POST /api/admin/auth/register — self-serve restaurant signup (public).
authRouter.post('/register', registerLimiter, async (req, res) => {
  sendOk(res, await registerStore(registerSchema.parse(req.body)));
});

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
