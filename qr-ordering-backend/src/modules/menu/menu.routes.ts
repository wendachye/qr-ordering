import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';

import { requireAdmin, requirePermission } from '../../middleware/auth';
import { requireActiveSubscription } from '../../middleware/subscription';
import { sendCreated, sendOk } from '../../lib/response';
import {
  createCategorySchema,
  createItemSchema,
  featureSchema,
  menuSettingsSchema,
  moveItemSchema,
  outletStateSchema,
  reorderSchema,
  soldOutSchema,
  updateCategorySchema,
  updateItemSchema,
} from '../../validators/menu';
import {
  createCategory,
  createItem,
  deleteCategory,
  deleteItem,
  getMenuSettings,
  listCategories,
  listItems,
  moveItem,
  reorderCategories,
  reorderFeatured,
  reorderItems,
  setItemAvailability,
  setItemFeatured,
  setItemOutletState,
  updateCategory,
  updateItem,
  updateMenuSettings,
} from './menu.service';
import { getPosMenuForTable } from '../public/public.service';
import { createComboSchema, updateComboSchema } from '../../validators/combo';
import { createCombo, deleteCombo, listCombos, updateCombo } from './combo.service';

export const menuRouter = Router();

menuRouter.use(requireAdmin, requireActiveSubscription);
// Reads (GET) are open to any staff (the POS needs the menu); any mutation
// requires the 'menu:manage' permission (owner / manager).
menuRouter.use((req, res, next) =>
  req.method === 'GET' ? next() : requirePermission('menu:manage')(req, res, next),
);

// GET /api/admin/menu/pos-menu?tableCode=...  — the customer-shaped menu plus
// POS-only ("secret") items, for the staff POS order screens.
menuRouter.get('/pos-menu', async (req, res) => {
  const { tableCode } = z.object({ tableCode: z.string().min(1) }).parse(req.query);
  sendOk(res, await getPosMenuForTable(tableCode));
});

/* ----------------------------- Categories ----------------------------- */

menuRouter.get('/categories', async (_req, res) => {
  sendOk(res, await listCategories());
});

menuRouter.post('/categories', async (req, res) => {
  sendCreated(res, await createCategory(createCategorySchema.parse(req.body)));
});

// Declared before "/categories/:id" so the literal path isn't captured by :id.
menuRouter.patch('/categories/reorder', async (req, res) => {
  const { ids } = reorderSchema.parse(req.body);
  sendOk(res, await reorderCategories(ids));
});

menuRouter.patch('/categories/:id', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await updateCategory(req.params.id, updateCategorySchema.parse(req.body)));
});

menuRouter.delete('/categories/:id', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await deleteCategory(req.params.id));
});

/* -------------------------------- Items -------------------------------- */

menuRouter.get('/items', async (req, res) => {
  const { categoryId } = z.object({ categoryId: z.string().min(1).optional() }).parse(req.query);
  sendOk(res, await listItems(categoryId));
});

menuRouter.post('/items', async (req, res) => {
  sendCreated(res, await createItem(createItemSchema.parse(req.body)));
});

// Declared before "/items/:id" so the literal path isn't captured by :id.
menuRouter.patch('/items/reorder', async (req, res) => {
  const { ids } = reorderSchema.parse(req.body);
  sendOk(res, await reorderItems(ids));
});

menuRouter.patch('/items/:id', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await updateItem(req.params.id, updateItemSchema.parse(req.body)));
});

menuRouter.delete('/items/:id', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await deleteItem(req.params.id));
});

// PATCH /api/admin/menu/items/:id/sold-out  body: { isAvailable: boolean }
menuRouter.patch('/items/:id/sold-out', async (req: Request<{ id: string }>, res) => {
  const { isAvailable } = soldOutSchema.parse(req.body);
  sendOk(res, await setItemAvailability(req.params.id, isAvailable));
});

// PATCH /api/admin/menu/items/:id/outlet-state
//   body: { price?, isAvailable?, isActive? }  (null on a field clears it)
// This outlet's per-store overrides on a shared catalogue (price / 86 / hide).
menuRouter.patch('/items/:id/outlet-state', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await setItemOutletState(req.params.id, outletStateSchema.parse(req.body)));
});

// PATCH /api/admin/menu/items/:id/move  body: { categoryId }
menuRouter.patch('/items/:id/move', async (req: Request<{ id: string }>, res) => {
  const { categoryId } = moveItemSchema.parse(req.body);
  sendOk(res, await moveItem(req.params.id, categoryId));
});

// PATCH /api/admin/menu/items/featured/reorder  body: { ids }
menuRouter.patch('/items/featured/reorder', async (req, res) => {
  const { ids } = reorderSchema.parse(req.body);
  sendOk(res, await reorderFeatured(ids));
});

// PATCH /api/admin/menu/items/:id/feature  body: { isFeatured }
menuRouter.patch('/items/:id/feature', async (req: Request<{ id: string }>, res) => {
  const { isFeatured } = featureSchema.parse(req.body);
  sendOk(res, await setItemFeatured(req.params.id, isFeatured));
});

// --- Combos / set meals ---
menuRouter.get('/combos', async (_req, res) => {
  sendOk(res, await listCombos());
});
menuRouter.post('/combos', async (req, res) => {
  sendCreated(res, await createCombo(createComboSchema.parse(req.body)));
});
menuRouter.patch('/combos/:id', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await updateCombo(req.params.id, updateComboSchema.parse(req.body)));
});
menuRouter.delete('/combos/:id', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await deleteCombo(req.params.id));
});

// GET/PATCH /api/admin/menu/settings  { featuredTitle }
menuRouter.get('/settings', async (_req, res) => {
  sendOk(res, await getMenuSettings());
});

menuRouter.patch('/settings', async (req, res) => {
  sendOk(res, await updateMenuSettings(menuSettingsSchema.parse(req.body)));
});
