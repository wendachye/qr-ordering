import { Router } from 'express';
import type { Request } from 'express';

import { requireAdmin } from '../../middleware/auth';
import { sendOk } from '../../lib/response';
import { listMyOutlets, switchOutlet } from './adminOutlets.service';

// /api/admin/outlets — a client owner switching between their own outlets.
// Behind requireAdmin only (NOT requireActiveSubscription): switching is an
// account-level action that must work regardless of any one outlet's billing.
export const adminOutletsRouter = Router();
adminOutletsRouter.use(requireAdmin);

// GET /api/admin/outlets — the outlets in the current admin's client.
adminOutletsRouter.get('/', async (req, res) => {
  sendOk(res, await listMyOutlets(req.admin!.storeId));
});

// POST /api/admin/outlets/:storeId/switch — switch to a sibling outlet.
adminOutletsRouter.post('/:storeId/switch', async (req: Request<{ storeId: string }>, res) => {
  sendOk(
    res,
    await switchOutlet(
      { id: req.admin!.id, email: req.admin!.email, storeId: req.admin!.storeId },
      req.params.storeId,
    ),
  );
});
