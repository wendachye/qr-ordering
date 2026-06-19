import { Router } from 'express';

import { generalLimiter } from '../middleware/rateLimit';
import { publicRouter } from '../modules/public/public.routes';
import { ordersRouter } from '../modules/orders/orders.routes';
import { authRouter } from '../modules/auth/auth.routes';
import { adminOrdersRouter } from '../modules/admin/adminOrders.routes';
import { adminTablesRouter } from '../modules/admin/adminTables.routes';
import { adminFloorRouter, adminSessionsRouter } from '../modules/admin/adminSessions.routes';
import { adminReportsRouter } from '../modules/admin/adminReports.routes';
import { adminSettingsRouter } from '../modules/admin/adminSettings.routes';
import { adminVouchersRouter } from '../modules/admin/adminVouchers.routes';
import { adminLoyaltyRouter } from '../modules/admin/adminLoyalty.routes';
import { adminPlatformRouter } from '../modules/admin/platform.routes';
import { adminOutletsRouter } from '../modules/admin/adminOutlets.routes';
import { menuRouter } from '../modules/menu/menu.routes';
import { uploadsRouter } from '../modules/uploads/uploads.routes';
import { printAgentRouter } from '../modules/print-jobs/printJobs.routes';
import { billingRouter } from '../modules/billing/billing.routes';

// Central API route table. Mounted once by createApp(). The Stripe webhook,
// static /uploads, and health/metrics stay in app.ts because they depend on
// body-parse ordering / are infra rather than feature APIs.
export const apiRouter = Router();

// Broad per-IP flood backstop across the API surface. The local print agent
// (/api/print-agent) is intentionally excluded — it polls frequently and is
// already gated by its own shared-secret key.
apiRouter.use('/api/public', generalLimiter);
apiRouter.use('/api/orders', generalLimiter);
apiRouter.use('/api/admin', generalLimiter);

// Public (customer) APIs
apiRouter.use('/api/public', publicRouter);
apiRouter.use('/api/orders', ordersRouter);

// Admin APIs
apiRouter.use('/api/admin/auth', authRouter);
apiRouter.use('/api/admin/billing', billingRouter);
apiRouter.use('/api/admin/orders', adminOrdersRouter);
apiRouter.use('/api/admin/tables', adminTablesRouter);
apiRouter.use('/api/admin/floor', adminFloorRouter);
apiRouter.use('/api/admin/sessions', adminSessionsRouter);
apiRouter.use('/api/admin/reports', adminReportsRouter);
apiRouter.use('/api/admin/settings', adminSettingsRouter);
apiRouter.use('/api/admin/vouchers', adminVouchersRouter);
apiRouter.use('/api/admin/loyalty', adminLoyaltyRouter);
apiRouter.use('/api/admin/platform', adminPlatformRouter);
apiRouter.use('/api/admin/outlets', adminOutletsRouter);
apiRouter.use('/api/admin/menu', menuRouter);
apiRouter.use('/api/admin/uploads', uploadsRouter);

// Local print agent API
apiRouter.use('/api/print-agent', printAgentRouter);
