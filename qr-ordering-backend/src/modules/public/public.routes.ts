import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';

import { sendOk } from '../../lib/response';
import { applyVoucherSchema } from '../../validators/voucher';
import { applyVoucherToTable } from '../admin/vouchers.service';
import { getMenuForTable, getTableByCode } from './public.service';
import { getReceipt } from './receipt.service';

export const publicRouter = Router();

// POST /api/public/voucher — a customer applies a voucher code to their table's
// open tab. Validates the code and attaches it; the discount is realised when
// staff settle the bill.
publicRouter.post('/voucher', async (req, res) => {
  const { tableCode, code } = applyVoucherSchema.parse(req.body);
  sendOk(res, await applyVoucherToTable(tableCode, code));
});

// GET /api/public/tables/:tableCode
publicRouter.get('/tables/:tableCode', async (req: Request<{ tableCode: string }>, res) => {
  sendOk(res, await getTableByCode(req.params.tableCode));
});

// GET /api/public/menu?tableCode=TBL001
publicRouter.get('/menu', async (req, res) => {
  const { tableCode } = z
    .object({ tableCode: z.string().min(1, 'tableCode query param is required') })
    .parse(req.query);
  sendOk(res, await getMenuForTable(tableCode));
});

// GET /api/public/receipt/:id — the diner-facing receipt for a settled tab.
publicRouter.get('/receipt/:id', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await getReceipt(req.params.id));
});
