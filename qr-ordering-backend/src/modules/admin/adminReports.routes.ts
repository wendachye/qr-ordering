import { Router } from 'express';

import { requireAdmin } from '../../middleware/auth';
import { requireActiveSubscription } from '../../middleware/subscription';
import { sendOk } from '../../lib/response';
import { salesReportQuerySchema } from '../../validators/report';
import { getSalesReport } from './adminReports.service';

// /api/admin/reports — sales reporting.
export const adminReportsRouter = Router();
adminReportsRouter.use(requireAdmin, requireActiveSubscription);

// GET /api/admin/reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD
// Sales report for a business-day range (one day = a Z reading; a month or
// custom range aggregates the same breakdowns).
adminReportsRouter.get('/sales', async (req, res) => {
  const { from, to } = salesReportQuerySchema.parse(req.query);
  sendOk(res, await getSalesReport(from, to));
});
