import { Router } from 'express';
import type { Request } from 'express';

import { requireAdmin, requirePlatformAdmin } from '../../middleware/auth';
import { sendCreated, sendOk } from '../../lib/response';
import {
  addOutletSchema,
  applyPlanSchema,
  createClientSchema,
  updateClientSchema,
  auditQuerySchema,
  updateOutletSchema,
  updatePlanSchema,
} from '../../validators/platform';
import { listAuditLog, listPlans, updatePlan } from './platform.service';
import {
  addOutlet,
  applyPlanToClient,
  createClient,
  getClient,
  impersonateOutlet,
  listClients,
  updateClient,
  updateOutlet,
} from './clients.service';

// /api/admin/platform — platform super-admin console (global Plan definitions).
// NOT behind requireActiveSubscription: the operator manages plans regardless of
// any single store's billing.
export const adminPlatformRouter = Router();
adminPlatformRouter.use(requireAdmin, requirePlatformAdmin);

adminPlatformRouter.get('/plans', async (_req, res) => {
  sendOk(res, await listPlans());
});
adminPlatformRouter.patch('/plans/:key', async (req: Request<{ key: string }>, res) => {
  sendOk(res, await updatePlan(req.params.key, updatePlanSchema.parse(req.body)));
});

// --- Operator audit log (read-only) ---
adminPlatformRouter.get('/audit', async (req, res) => {
  sendOk(res, await listAuditLog(auditQuerySchema.parse(req.query)));
});

// --- Clients + outlets (manage every restaurant account on the platform) ---
adminPlatformRouter.get('/clients', async (_req, res) => {
  sendOk(res, await listClients());
});
adminPlatformRouter.post('/clients', async (req, res) => {
  sendCreated(res, await createClient(createClientSchema.parse(req.body)));
});
adminPlatformRouter.get('/clients/:id', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await getClient(req.params.id));
});
adminPlatformRouter.patch('/clients/:id', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await updateClient(req.params.id, updateClientSchema.parse(req.body)));
});
adminPlatformRouter.post('/clients/:id/outlets', async (req: Request<{ id: string }>, res) => {
  sendCreated(res, await addOutlet(req.params.id, addOutletSchema.parse(req.body)));
});
adminPlatformRouter.post('/clients/:id/apply-plan', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await applyPlanToClient(req.params.id, applyPlanSchema.parse(req.body)));
});
adminPlatformRouter.patch('/outlets/:storeId', async (req: Request<{ storeId: string }>, res) => {
  sendOk(res, await updateOutlet(req.params.storeId, updateOutletSchema.parse(req.body)));
});
adminPlatformRouter.post(
  '/outlets/:storeId/impersonate',
  async (req: Request<{ storeId: string }>, res) => {
    sendOk(
      res,
      await impersonateOutlet(req.params.storeId, { id: req.admin!.id, email: req.admin!.email }),
    );
  },
);
