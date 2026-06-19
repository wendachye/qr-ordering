import { Router } from 'express';

import { requireAdmin } from '../../middleware/auth';
import { sendOk } from '../../lib/response';
import { getEntitlementsState } from './entitlements.service';

// /api/admin/entitlements — the tenant's effective plan features + limits +
// usage. Authenticated but NOT subscription-gated (the UI needs it to render the
// locked state even when the subscription has lapsed).
export const adminEntitlementsRouter = Router();
adminEntitlementsRouter.use(requireAdmin);

adminEntitlementsRouter.get('/', async (_req, res) => {
  sendOk(res, await getEntitlementsState());
});
