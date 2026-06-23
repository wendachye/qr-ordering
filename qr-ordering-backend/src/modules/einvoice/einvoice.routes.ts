import { Router } from 'express';
import type { Request } from 'express';

import { sendCreated, sendOk } from '../../lib/response';
import { requireAdmin, requirePermission } from '../../middleware/auth';
import { requireActiveSubscription } from '../../middleware/subscription';
import { einvoiceSettingsSchema, issueInvoiceSchema } from '../../validators/einvoice';
import {
  getEinvoiceSettings,
  getInvoice,
  getInvoiceForSession,
  issueInvoiceForSession,
  listInvoices,
  submitInvoice,
  updateEinvoiceSettings,
} from './einvoice.service';

export const einvoiceRouter = Router();
einvoiceRouter.use(requireAdmin, requireActiveSubscription);

// --- Seller settings (gated by settings:manage) ---
einvoiceRouter.get('/settings', requirePermission('settings:manage'), async (_req, res) => {
  sendOk(res, await getEinvoiceSettings());
});
einvoiceRouter.patch('/settings', requirePermission('settings:manage'), async (req, res) => {
  sendOk(res, await updateEinvoiceSettings(einvoiceSettingsSchema.parse(req.body)));
});

// --- Invoices (financial documents — gated by reports:view) ---
einvoiceRouter.use(requirePermission('reports:view'));

einvoiceRouter.get('/invoices', async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const offset = req.query.offset ? Number(req.query.offset) : undefined;
  sendOk(res, await listInvoices({ limit, offset }));
});

einvoiceRouter.get('/invoices/:id', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await getInvoice(req.params.id));
});

einvoiceRouter.post('/invoices/:id/submit', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await submitInvoice(req.params.id));
});

// The invoice for a given settled tab (null if none issued yet).
einvoiceRouter.get('/sessions/:sessionId/invoice', async (req: Request<{ sessionId: string }>, res) => {
  sendOk(res, await getInvoiceForSession(req.params.sessionId));
});

// Issue a tax invoice for a settled tab (captures buyer details from the body).
einvoiceRouter.post('/sessions/:sessionId/issue', async (req: Request<{ sessionId: string }>, res) => {
  sendCreated(res, await issueInvoiceForSession(req.params.sessionId, issueInvoiceSchema.parse(req.body)));
});
