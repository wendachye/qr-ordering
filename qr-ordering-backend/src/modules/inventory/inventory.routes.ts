import { Router } from 'express';
import type { Request } from 'express';

import { sendOk } from '../../lib/response';
import { requireAdmin, requirePermission } from '../../middleware/auth';
import { requireActiveSubscription } from '../../middleware/subscription';
import { adjustStockSchema, stockConfigSchema } from '../../validators/inventory';
import { adjustStock, listLowStock, listStockLedger, setStockConfig } from './inventory.service';

export const inventoryRouter = Router();

// Stock management is gated behind the menu permission (manager/owner) and an
// active subscription (mirrors the menu routes).
inventoryRouter.use(requireAdmin, requireActiveSubscription);
inventoryRouter.use(requirePermission('menu:manage'));

const actorOf = (req: Request) => ({ id: req.admin!.id, email: req.admin!.email });

// GET /admin/inventory/low-stock — tracked items at/below their threshold.
inventoryRouter.get('/low-stock', async (_req, res) => {
  sendOk(res, await listLowStock());
});

// POST /admin/inventory/:id/adjust — a restock (+) or waste (−) move.
inventoryRouter.post('/:id/adjust', async (req: Request<{ id: string }>, res) => {
  const input = adjustStockSchema.parse(req.body);
  sendOk(res, await adjustStock(req.params.id, input, actorOf(req)));
});

// PATCH /admin/inventory/:id/config — turn tracking on/off, set count + threshold.
inventoryRouter.patch('/:id/config', async (req: Request<{ id: string }>, res) => {
  const input = stockConfigSchema.parse(req.body);
  sendOk(res, await setStockConfig(req.params.id, input, actorOf(req)));
});

// GET /admin/inventory/:id/ledger — recent stock movements for an item.
inventoryRouter.get('/:id/ledger', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await listStockLedger(req.params.id));
});
