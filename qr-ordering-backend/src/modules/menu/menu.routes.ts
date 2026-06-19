import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';

import { requireAdmin } from '../../middleware/auth';
import { requireActiveSubscription } from '../../middleware/subscription';
import { sendCreated, sendOk } from '../../lib/response';
import {
  createCategorySchema,
  createItemSchema,
  featureSchema,
  menuSettingsSchema,
  moveItemSchema,
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
  updateCategory,
  updateItem,
  updateMenuSettings,
} from './menu.service';
import { getPosMenuForTable } from '../public/public.service';

export const menuRouter = Router();

menuRouter.use(requireAdmin, requireActiveSubscription);

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

// GET/PATCH /api/admin/menu/settings  { featuredTitle }
menuRouter.get('/settings', async (_req, res) => {
  sendOk(res, await getMenuSettings());
});

menuRouter.patch('/settings', async (req, res) => {
  sendOk(res, await updateMenuSettings(menuSettingsSchema.parse(req.body)));
});
