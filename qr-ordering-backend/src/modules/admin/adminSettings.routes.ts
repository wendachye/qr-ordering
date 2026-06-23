import { Router } from 'express';

import { requireAdmin, requirePermission } from '../../middleware/auth';
import { pinVerifyLimiter } from '../../middleware/rateLimit';
import { sendOk } from '../../lib/response';
import { setPinSchema, settingsUpdateSchema, verifyPinSchema } from '../../validators/settings';
import {
  getSettings,
  setOverridePin,
  updateSettings,
  verifyOverridePin,
} from './adminSettings.service';

// /api/admin/settings — store-level settings + the override PIN. Part of the
// always-reachable "account" area (with billing), so NOT subscription-gated.
export const adminSettingsRouter = Router();
adminSettingsRouter.use(requireAdmin);

adminSettingsRouter.get('/', async (_req, res) => {
  sendOk(res, await getSettings());
});

// Editing settings + the override PIN needs settings:manage (owner / manager).
// GET settings + verify-PIN stay open (the POS reads payment methods + checks the
// PIN to authorise an override).
adminSettingsRouter.patch('/', requirePermission('settings:manage'), async (req, res) => {
  sendOk(res, await updateSettings(settingsUpdateSchema.parse(req.body)));
});

// POST /api/admin/settings/pin — set/change the override PIN (needs password).
adminSettingsRouter.post('/pin', requirePermission('settings:manage'), async (req, res) => {
  const { currentPassword, pin } = setPinSchema.parse(req.body);
  sendOk(res, await setOverridePin(req.admin!.id, currentPassword, pin));
});

// POST /api/admin/settings/pin/verify — authorise a price override. Rate-limited
// per IP (returns 200 even for a wrong PIN, so this is the brute-force guard).
adminSettingsRouter.post('/pin/verify', pinVerifyLimiter, async (req, res) => {
  const { pin } = verifyPinSchema.parse(req.body);
  sendOk(res, await verifyOverridePin(pin));
});
