import { Router } from 'express';
import type { Request } from 'express';

import { requireAdmin } from '../../middleware/auth';
import { requireActiveSubscription } from '../../middleware/subscription';
import { requireFeature } from '../../middleware/features';
import { sendCreated, sendOk } from '../../lib/response';
import { createVoucherSchema, updateVoucherSchema } from '../../validators/voucher';
import { createVoucher, deleteVoucher, listVouchers, updateVoucher } from './vouchers.service';

// /api/admin/vouchers — discount voucher management. Routes wire paths +
// middleware to thin inline handlers that parse, validate, and call the service.
export const adminVouchersRouter = Router();
adminVouchersRouter.use(requireAdmin, requireActiveSubscription, requireFeature('vouchers'));

adminVouchersRouter.get('/', async (_req, res) => {
  sendOk(res, await listVouchers());
});

adminVouchersRouter.post('/', async (req, res) => {
  sendCreated(res, await createVoucher(createVoucherSchema.parse(req.body)));
});

adminVouchersRouter.patch('/:id', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await updateVoucher(req.params.id, updateVoucherSchema.parse(req.body)));
});

adminVouchersRouter.delete('/:id', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await deleteVoucher(req.params.id));
});
