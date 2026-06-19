import { Router } from 'express';
import type { Request } from 'express';

import { requirePrintAgent } from '../../middleware/printAgentAuth';
import { sendOk } from '../../lib/response';
import { markFailedSchema } from '../../validators/printJob';
import { getDueJobs, markFailed, markPrinted, markPrinting } from './printJobs.service';

export const printAgentRouter = Router();

// Every print-agent route requires the shared x-print-agent-key header.
printAgentRouter.use(requirePrintAgent);

// GET /api/print-agent/jobs/pending — jobs due to print now (incl. retries + stuck).
printAgentRouter.get('/jobs/pending', async (_req, res) => {
  sendOk(res, await getDueJobs());
});

// POST /api/print-agent/jobs/:id/mark-printing
printAgentRouter.post('/jobs/:id/mark-printing', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await markPrinting(req.params.id));
});

// POST /api/print-agent/jobs/:id/mark-printed
printAgentRouter.post('/jobs/:id/mark-printed', async (req: Request<{ id: string }>, res) => {
  sendOk(res, await markPrinted(req.params.id));
});

// POST /api/print-agent/jobs/:id/mark-failed   body: { error: string }
printAgentRouter.post('/jobs/:id/mark-failed', async (req: Request<{ id: string }>, res) => {
  const { error } = markFailedSchema.parse(req.body);
  sendOk(res, await markFailed(req.params.id, error));
});
