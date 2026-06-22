import { Router } from 'express';
import type { Request } from 'express';

import { requireAdmin, requirePermission } from '../../middleware/auth';
import { requireActiveSubscription } from '../../middleware/subscription';
import { sendCreated, sendOk } from '../../lib/response';
import { createStaffSchema, updateStaffSchema } from '../../validators/staff';
import { createStaff, listStaff, updateStaff } from './adminStaff.service';

// /api/admin/staff — manage the store's staff accounts (RBAC). Gated to roles
// with the 'staff:manage' permission (owner / manager); a manager can only touch
// cashier / waiter accounts (enforced in the service).
export const adminStaffRouter = Router();
adminStaffRouter.use(requireAdmin, requireActiveSubscription, requirePermission('staff:manage'));

adminStaffRouter.get('/', async (_req, res) => {
  sendOk(res, await listStaff());
});

adminStaffRouter.post('/', async (req, res) => {
  const actor = { id: req.admin!.id, role: req.admin!.role };
  sendCreated(res, await createStaff(actor, createStaffSchema.parse(req.body)));
});

adminStaffRouter.patch('/:id', async (req: Request<{ id: string }>, res) => {
  const actor = { id: req.admin!.id, role: req.admin!.role };
  sendOk(res, await updateStaff(actor, req.params.id, updateStaffSchema.parse(req.body)));
});
