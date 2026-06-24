import { Router } from 'express';
import type { Request } from 'express';

import { requireAdmin, requirePermission } from '../../middleware/auth';
import { requireActiveSubscription } from '../../middleware/subscription';
import { sendOk } from '../../lib/response';
import { listTrash, restore } from './trash.service';

// /api/admin/trash — soft-deleted catalog/config rows + restore. Gated to roles
// with 'settings:manage' (owner / manager).
export const adminTrashRouter = Router();
adminTrashRouter.use(requireAdmin, requireActiveSubscription, requirePermission('settings:manage'));

adminTrashRouter.get('/', async (_req, res) => {
  sendOk(res, await listTrash());
});

adminTrashRouter.post(
  '/:resource/:id/restore',
  async (req: Request<{ resource: string; id: string }>, res) => {
    sendOk(res, await restore(req.params.resource, req.params.id));
  },
);
