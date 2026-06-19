import { Router } from 'express';
import type { Request } from 'express';

import { requireAdmin } from '../../middleware/auth';
import { requireActiveSubscription } from '../../middleware/subscription';
import { sendCreated, sendOk } from '../../lib/response';
import { createTableSchema, updateTableSchema } from '../../validators/table';
import { createTable, deleteTable, listTables, updateTable } from './adminTables.service';

export const adminTablesRouter = Router();

adminTablesRouter.use(requireAdmin, requireActiveSubscription);

// GET /api/admin/tables
adminTablesRouter.get('/', async (_req, res) => {
  sendOk(res, await listTables());
});

// POST /api/admin/tables
adminTablesRouter.post('/', async (req, res) => {
  sendCreated(res, await createTable(createTableSchema.parse(req.body)));
});

// PATCH /api/admin/tables/:id
adminTablesRouter.patch('/:id', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await updateTable(req.params.id, updateTableSchema.parse(req.body)));
});

// DELETE /api/admin/tables/:id
adminTablesRouter.delete('/:id', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await deleteTable(req.params.id));
});
