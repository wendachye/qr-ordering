import { Router } from 'express';

import { sendCreated } from '../../lib/response';
import { idempotencyKeyFrom, runIdempotent } from '../../lib/idempotency';
import { orderLimiter } from '../../middleware/rateLimit';
import { createOrderSchema } from '../../validators/order';
import { createOrder } from './orders.service';

export const ordersRouter = Router();

// POST /api/orders  (public — customer order submission)
// An optional Idempotency-Key header de-dupes double-submits / network retries.
ordersRouter.post('/', orderLimiter, async (req, res) => {
  const input = createOrderSchema.parse(req.body);
  const key = idempotencyKeyFrom(req.header('Idempotency-Key'));
  const { data } = await runIdempotent(input.tableCode, key, () => createOrder(input));
  sendCreated(res, data);
});
