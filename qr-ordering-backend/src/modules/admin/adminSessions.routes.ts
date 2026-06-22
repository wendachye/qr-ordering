import { Router } from 'express';
import type { Request } from 'express';

import { requireAdmin } from '../../middleware/auth';
import { requireActiveSubscription } from '../../middleware/subscription';
import { sendOk } from '../../lib/response';
import {
  closeSessionSchema,
  combineSessionSchema,
  moveSessionSchema,
  payTabSchema,
  sessionListQuerySchema,
  sessionPaxSchema,
} from '../../validators/session';
import {
  cancelSession,
  closeSession,
  combineSessions,
  getFloor,
  getSession,
  listSessions,
  moveSession,
  recordPayment,
  reopenSession,
  setSessionPax,
} from './adminSessions.service';

// GET /api/admin/floor — the live floor: tables + their open session summary.
export const adminFloorRouter = Router();
adminFloorRouter.use(requireAdmin, requireActiveSubscription);
adminFloorRouter.get('/', async (_req, res) => {
  sendOk(res, await getFloor());
});

// /api/admin/sessions — session history + detail + close/cancel.
export const adminSessionsRouter = Router();
adminSessionsRouter.use(requireAdmin, requireActiveSubscription);

// GET /api/admin/sessions?status=CLOSED
adminSessionsRouter.get('/', async (req, res) => {
  const { status, tableId } = sessionListQuerySchema.parse(req.query);
  sendOk(res, await listSessions(status, tableId));
});

// GET /api/admin/sessions/:id
adminSessionsRouter.get('/:id', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await getSession(req.params.id));
});

// PATCH /api/admin/sessions/:id/pax — set guests seated on the tab.
adminSessionsRouter.patch('/:id/pax', async (req: Request<{ id: string }>, res) => {
  const { pax } = sessionPaxSchema.parse(req.body);
  sendOk(res, await setSessionPax(req.params.id, pax));
});

// POST /api/admin/sessions/:id/close — settle the tab in full with a payment
// method (and an optional bill-level discount).
adminSessionsRouter.post('/:id/close', async (req: Request<{ id: string }>, res) => {
  const input = closeSessionSchema.parse(req.body);
  sendOk(res, await closeSession(req.params.id, input));
});

// POST /api/admin/sessions/:id/pay — record a tender (full or partial/split). The
// tab stays open with a balance until the running paid total reaches the net.
adminSessionsRouter.post('/:id/pay', async (req: Request<{ id: string }>, res) => {
  const input = payTabSchema.parse(req.body);
  sendOk(res, await recordPayment(req.params.id, input));
});

// POST /api/admin/sessions/:id/cancel
adminSessionsRouter.post('/:id/cancel', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await cancelSession(req.params.id));
});

// POST /api/admin/sessions/:id/move — relocate the tab to a free table.
adminSessionsRouter.post('/:id/move', async (req: Request<{ id: string }>, res) => {
  const { targetTableId } = moveSessionSchema.parse(req.body);
  sendOk(res, await moveSession(req.params.id, targetTableId));
});

// POST /api/admin/sessions/:id/combine — merge another open tab into this one.
adminSessionsRouter.post('/:id/combine', async (req: Request<{ id: string }>, res) => {
  const { sourceSessionId } = combineSessionSchema.parse(req.body);
  sendOk(res, await combineSessions(req.params.id, sourceSessionId));
});

// POST /api/admin/sessions/:id/reopen — restore a closed tab onto its table.
adminSessionsRouter.post('/:id/reopen', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await reopenSession(req.params.id));
});
