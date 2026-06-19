import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';

import { sendCreated, sendOk } from '../../lib/response';
import { requireAdmin } from '../../middleware/auth';
import { requireActiveSubscription } from '../../middleware/subscription';
import { requireFeature } from '../../middleware/features';
import {
  adjustPointsSchema,
  createMemberSchema,
  createRewardSchema,
  loyaltyConfigSchema,
  updateMemberSchema,
  updateRewardSchema,
} from '../../validators/loyalty';
import {
  adjustPoints,
  createMember,
  createReward,
  deleteMember,
  deleteReward,
  getLoyaltyConfig,
  getMember,
  listMembers,
  listRewards,
  updateLoyaltyConfig,
  updateMember,
  updateReward,
} from './loyalty.service';

// /api/admin/loyalty — program config + member management + reward catalog.
export const adminLoyaltyRouter = Router();
adminLoyaltyRouter.use(requireAdmin, requireActiveSubscription, requireFeature('loyalty'));

// --- Program config ---
adminLoyaltyRouter.get('/config', async (_req, res) => {
  sendOk(res, await getLoyaltyConfig());
});
adminLoyaltyRouter.patch('/config', async (req, res) => {
  sendOk(res, await updateLoyaltyConfig(loyaltyConfigSchema.parse(req.body)));
});

// --- Members ---
adminLoyaltyRouter.get('/members', async (req, res) => {
  const { search } = z.object({ search: z.string().optional() }).parse(req.query);
  sendOk(res, await listMembers(search));
});
adminLoyaltyRouter.post('/members', async (req, res) => {
  sendCreated(res, await createMember(createMemberSchema.parse(req.body)));
});
adminLoyaltyRouter.get('/members/:id', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await getMember(req.params.id));
});
adminLoyaltyRouter.patch('/members/:id', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await updateMember(req.params.id, updateMemberSchema.parse(req.body)));
});
adminLoyaltyRouter.delete('/members/:id', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await deleteMember(req.params.id));
});
adminLoyaltyRouter.post('/members/:id/adjust', async (req: Request<{ id: string }>, res) => {
  const { points, reason } = adjustPointsSchema.parse(req.body);
  sendOk(res, await adjustPoints(req.params.id, points, reason));
});

// --- Reward catalog ---
adminLoyaltyRouter.get('/rewards', async (_req, res) => {
  sendOk(res, await listRewards());
});
adminLoyaltyRouter.post('/rewards', async (req, res) => {
  sendCreated(res, await createReward(createRewardSchema.parse(req.body)));
});
adminLoyaltyRouter.patch('/rewards/:id', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await updateReward(req.params.id, updateRewardSchema.parse(req.body)));
});
adminLoyaltyRouter.delete('/rewards/:id', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await deleteReward(req.params.id));
});
