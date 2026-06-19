import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';

import { requireAdmin } from '../../middleware/auth';
import { requireActiveSubscription } from '../../middleware/subscription';
import { orderLimiter } from '../../middleware/rateLimit';
import { sendCreated, sendOk } from '../../lib/response';
import { runIdempotent, idempotencyKeyFrom } from '../../lib/idempotency';
import {
  createAdminOrderSchema,
  updateOrderStatusSchema,
  voidItemSchema,
} from '../../validators/order';
import { createOrder } from '../orders/orders.service';
import { getPrintHealth } from '../print-jobs/printJobs.service';
import {
  getOrder,
  listOrders,
  listTableOrders,
  reprintOrder,
  updateOrderStatus,
  voidOrderItem,
} from './adminOrders.service';

export const adminOrdersRouter = Router();

// All admin order routes require a valid admin JWT.
adminOrdersRouter.use(requireAdmin, requireActiveSubscription);

// POST /api/admin/orders — staff order entry (honours price override + takeaway).
adminOrdersRouter.post('/', orderLimiter, async (req, res) => {
  const input = createAdminOrderSchema.parse(req.body);
  const key = idempotencyKeyFrom(req.header('Idempotency-Key'));
  const { data } = await runIdempotent(input.tableCode, key, () =>
    createOrder(input, { admin: true }),
  );
  sendCreated(res, data);
});

// GET /api/admin/orders?status=NEW
adminOrdersRouter.get('/', async (req, res) => {
  const { status } = z
    .object({ status: z.enum(['NEW', 'COMPLETED', 'CANCELLED']).optional() })
    .parse(req.query);
  sendOk(res, await listOrders(status));
});

// GET /api/admin/orders/print-health — kitchen-printing health for this tenant.
// (declared before "/:id" so the literal path isn't captured by :id).
adminOrdersRouter.get('/print-health', async (_req, res) => {
  sendOk(res, await getPrintHealth());
});

// GET /api/admin/orders/table/:tableId — a table's order history
// (declared before "/:id" so the literal path isn't captured by :id).
adminOrdersRouter.get('/table/:tableId', async (req: Request<{ tableId: string }>, res) => {
  sendOk(res, await listTableOrders(req.params.tableId));
});

// POST /api/admin/orders/items/:id/void — void one item on an open tab.
adminOrdersRouter.post('/items/:id/void', async (req: Request<{ id: string }>, res) => {
  const { reason, pin } = voidItemSchema.parse(req.body);
  sendOk(res, await voidOrderItem(req.params.id, reason, pin));
});

// GET /api/admin/orders/:id
adminOrdersRouter.get('/:id', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await getOrder(req.params.id));
});

// PATCH /api/admin/orders/:id/status
adminOrdersRouter.patch('/:id/status', async (req: Request<{ id: string }>, res) => {
  const input = updateOrderStatusSchema.parse(req.body);
  sendOk(res, await updateOrderStatus(req.params.id, input));
});

// POST /api/admin/orders/:id/reprint
adminOrdersRouter.post('/:id/reprint', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await reprintOrder(req.params.id));
});
