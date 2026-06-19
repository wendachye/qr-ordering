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
import { adminEntitlementsRouter } from '../modules/admin/entitlements.routes';

// Central API route table. Mounted once by createApp(). The Stripe webhook,
// static /uploads, and health/metrics stay in app.ts because they depend on
// body-parse ordering / are infra rather than feature APIs.
export const apiRouter = Router();

// Broad per-IP flood backstop across the API surface. The local print agent
// (/api/v1/print-agent) is intentionally excluded — it polls frequently and is
// already gated by its own shared-secret key.
apiRouter.use('/public', generalLimiter);
apiRouter.use('/orders', generalLimiter);
apiRouter.use('/admin', generalLimiter);

// Public (customer) APIs
apiRouter.use('/public', publicRouter);
apiRouter.use('/orders', ordersRouter);

// Admin APIs
apiRouter.use('/admin/auth', authRouter);
apiRouter.use('/admin/billing', billingRouter);
apiRouter.use('/admin/entitlements', adminEntitlementsRouter);
apiRouter.use('/admin/orders', adminOrdersRouter);
apiRouter.use('/admin/tables', adminTablesRouter);
apiRouter.use('/admin/floor', adminFloorRouter);
apiRouter.use('/admin/sessions', adminSessionsRouter);
apiRouter.use('/admin/reports', adminReportsRouter);
apiRouter.use('/admin/settings', adminSettingsRouter);
apiRouter.use('/admin/vouchers', adminVouchersRouter);
apiRouter.use('/admin/loyalty', adminLoyaltyRouter);
apiRouter.use('/admin/platform', adminPlatformRouter);
apiRouter.use('/admin/outlets', adminOutletsRouter);
apiRouter.use('/admin/menu', menuRouter);
apiRouter.use('/admin/uploads', uploadsRouter);

// Local print agent API
apiRouter.use('/print-agent', printAgentRouter);
