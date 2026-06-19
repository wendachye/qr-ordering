/// <reference types="zod-openapi" />
/**
 * OpenAPI 3.1 document for the QR Ordering API, generated from the SAME Zod
 * validators the route handlers use (src/validators/*) via `zod-openapi`. The
 * document is assembled once at import time and served by app.ts at
 * `GET /api/openapi.json` + Swagger UI at `/api/docs`.
 *
 * Notes:
 * - Request bodies/queries reference the real validators, so they cannot drift
 *   from validation. The few inline (non-exported) query/param schemas are
 *   restated here.
 * - Responses are not Zod-typed in this codebase, so each is documented as the
 *   standard success envelope `{ success: true, data }` with `data` left open
 *   (typed incrementally later). Errors use the shared `{ success: false, error }`
 *   envelope produced by src/middleware/error.ts.
 */
import { z } from 'zod';
import {
  createDocument,
  type ZodOpenApiOperationObject,
  type ZodOpenApiPathsObject,
} from 'zod-openapi';

import { loginSchema, registerSchema, passwordVerifySchema } from '../validators/auth';
import {
  createOrderSchema,
  createAdminOrderSchema,
  updateOrderStatusSchema,
  voidItemSchema,
} from '../validators/order';
import { createTableSchema, updateTableSchema } from '../validators/table';
import {
  sessionListQuerySchema,
  sessionPaxSchema,
  closeSessionSchema,
  moveSessionSchema,
  combineSessionSchema,
} from '../validators/session';
import { salesReportQuerySchema } from '../validators/report';
import { settingsUpdateSchema, setPinSchema, verifyPinSchema } from '../validators/settings';
import {
  createVoucherSchema,
  updateVoucherSchema,
  applyVoucherSchema,
} from '../validators/voucher';
import {
  createMemberSchema,
  updateMemberSchema,
  adjustPointsSchema,
  createRewardSchema,
  updateRewardSchema,
  loyaltyConfigSchema,
} from '../validators/loyalty';
import {
  updatePlanSchema,
  createClientSchema,
  updateClientSchema,
  addOutletSchema,
  updateOutletSchema,
  applyPlanSchema,
  auditQuerySchema,
} from '../validators/platform';
import {
  createCategorySchema,
  updateCategorySchema,
  createItemSchema,
  updateItemSchema,
  soldOutSchema,
  reorderSchema,
  moveItemSchema,
  featureSchema,
  menuSettingsSchema,
} from '../validators/menu';
import { markFailedSchema } from '../validators/printJob';

// ---- Shared response envelopes -------------------------------------------

const ErrorResponse = z
  .object({
    success: z.literal(false),
    error: z.object({
      message: z.string(),
      code: z.string().optional(),
      details: z.unknown().optional(),
    }),
  })
  .meta({ id: 'ErrorResponse', description: 'Standard error envelope' });

const ERROR_DESCRIPTIONS: Record<string, string> = {
  '400': 'Validation error / bad request',
  '401': 'Missing or invalid credentials',
  '403': 'Forbidden',
  '404': 'Not found',
  '409': 'Conflict',
  '423': 'Locked',
  '429': 'Too many requests',
};

const AUTH_ERRS = ['400', '401', '403', '404', '409', '429'];
const PUBLIC_ERRS = ['400', '404', '429'];

const errorResponses = (codes: string[]) =>
  Object.fromEntries(
    codes.map((c) => [
      c,
      {
        description: ERROR_DESCRIPTIONS[c] ?? 'Error',
        content: { 'application/json': { schema: ErrorResponse } },
      },
    ]),
  );

const successResponse = (status: number, data: z.ZodTypeAny) => ({
  [String(status)]: {
    description: status === 201 ? 'Created' : 'OK',
    content: {
      'application/json': { schema: z.object({ success: z.literal(true), data }) },
    },
  },
});

// ---- Reusable path params -------------------------------------------------

const pathParam = (name: string) => ({ path: z.object({ [name]: z.string() }) });
const idempotencyHeader = {
  header: z.object({ 'Idempotency-Key': z.string().optional() }),
};

// ---- Operation builder ----------------------------------------------------

type Auth = 'bearer' | 'platform' | 'printAgent' | null;

function op(cfg: {
  tags: string[];
  summary: string;
  auth?: Auth;
  params?: ZodOpenApiOperationObject['requestParams'];
  body?: z.ZodTypeAny;
  multipart?: z.ZodTypeAny;
  status?: number;
  data?: z.ZodTypeAny;
  errorCodes?: string[];
}): ZodOpenApiOperationObject {
  const auth = cfg.auth ?? null;
  const security =
    auth === 'printAgent'
      ? [{ printAgentKey: [] as string[] }]
      : auth
        ? [{ bearerAuth: [] as string[] }]
        : undefined;
  const errorCodes = cfg.errorCodes ?? (auth ? AUTH_ERRS : PUBLIC_ERRS);

  const operation: ZodOpenApiOperationObject = {
    tags: cfg.tags,
    summary: cfg.summary,
    responses: {
      ...successResponse(cfg.status ?? 200, cfg.data ?? z.unknown()),
      ...errorResponses(errorCodes),
    },
  };
  if (security) operation.security = security;
  if (cfg.params) operation.requestParams = cfg.params;
  if (cfg.body) {
    operation.requestBody = { content: { 'application/json': { schema: cfg.body } } };
  }
  if (cfg.multipart) {
    operation.requestBody = { content: { 'multipart/form-data': { schema: cfg.multipart } } };
  }
  return operation;
}

// Inline (non-exported) query schemas restated from their route handlers.
const menuQuery = z.object({ tableCode: z.string().min(1) });
const orderStatusQuery = z.object({
  status: z.enum(['NEW', 'COMPLETED', 'CANCELLED']).optional(),
});
const checkoutBody = z.object({ plan: z.enum(['basic', 'pro']) });
const memberSearchQuery = z.object({ search: z.string().optional() });
const itemsQuery = z.object({ categoryId: z.string().min(1).optional() });
const uploadBody = z.object({
  file: z.string().meta({ format: 'binary', description: 'Image (PNG/JPEG/WEBP/GIF, max 5MB)' }),
});

// ---- Paths ----------------------------------------------------------------

const paths: ZodOpenApiPathsObject = {
  // Public (customer) — no auth
  '/api/v1/public/tables/{tableCode}': {
    get: op({
      tags: ['Public'],
      summary: 'Resolve a table by its QR code',
      params: pathParam('tableCode'),
    }),
  },
  '/api/v1/public/menu': {
    get: op({
      tags: ['Public'],
      summary: 'Get the menu for a table',
      params: { query: menuQuery },
    }),
  },
  '/api/v1/public/voucher': {
    post: op({ tags: ['Public'], summary: 'Apply a voucher to a table', body: applyVoucherSchema }),
  },
  '/api/v1/orders': {
    post: op({
      tags: ['Orders'],
      summary: 'Place a customer order',
      params: idempotencyHeader,
      body: createOrderSchema,
      status: 201,
    }),
  },

  // Admin auth
  '/api/v1/admin/auth/register': {
    post: op({
      tags: ['Auth'],
      summary: 'Register a new restaurant (tenant) + owner',
      body: registerSchema,
      status: 201,
      errorCodes: ['400', '409', '429'],
    }),
  },
  '/api/v1/admin/auth/login': {
    post: op({
      tags: ['Auth'],
      summary: 'Admin login → JWT',
      body: loginSchema,
      errorCodes: ['400', '401', '429'],
    }),
  },
  '/api/v1/admin/auth/me': {
    get: op({ tags: ['Auth'], summary: 'Current admin profile', auth: 'bearer' }),
  },
  '/api/v1/admin/auth/verify-password': {
    post: op({
      tags: ['Auth'],
      summary: 'Verify the current admin password',
      auth: 'bearer',
      body: passwordVerifySchema,
    }),
  },

  // Billing (account area — not subscription-gated)
  '/api/v1/admin/billing': {
    get: op({ tags: ['Billing'], summary: 'Billing / subscription state', auth: 'bearer' }),
  },
  '/api/v1/admin/billing/checkout': {
    post: op({
      tags: ['Billing'],
      summary: 'Create a Stripe Checkout session',
      auth: 'bearer',
      body: checkoutBody,
    }),
  },
  '/api/v1/admin/billing/portal': {
    post: op({
      tags: ['Billing'],
      summary: 'Create a Stripe Billing Portal session',
      auth: 'bearer',
    }),
  },
  '/api/v1/admin/billing/apply': {
    post: op({
      tags: ['Billing'],
      summary: 'Apply a plan directly (only when Stripe billing is disabled)',
      auth: 'bearer',
      body: checkoutBody,
    }),
  },

  // Admin orders
  '/api/v1/admin/orders': {
    post: op({
      tags: ['Orders'],
      summary: 'Staff places an order',
      auth: 'bearer',
      params: idempotencyHeader,
      body: createAdminOrderSchema,
      status: 201,
    }),
    get: op({
      tags: ['Orders'],
      summary: 'List orders',
      auth: 'bearer',
      params: { query: orderStatusQuery },
    }),
  },
  '/api/v1/admin/orders/print-health': {
    get: op({ tags: ['Orders'], summary: 'Kitchen print health', auth: 'bearer' }),
  },
  '/api/v1/admin/orders/table/{tableId}': {
    get: op({
      tags: ['Orders'],
      summary: 'Order history for a table',
      auth: 'bearer',
      params: pathParam('tableId'),
    }),
  },
  '/api/v1/admin/orders/items/{id}/void': {
    post: op({
      tags: ['Orders'],
      summary: 'Void a sent line item',
      auth: 'bearer',
      params: pathParam('id'),
      body: voidItemSchema,
    }),
  },
  '/api/v1/admin/orders/{id}': {
    get: op({
      tags: ['Orders'],
      summary: 'Order detail',
      auth: 'bearer',
      params: pathParam('id'),
    }),
  },
  '/api/v1/admin/orders/{id}/status': {
    patch: op({
      tags: ['Orders'],
      summary: 'Update order status',
      auth: 'bearer',
      params: pathParam('id'),
      body: updateOrderStatusSchema,
    }),
  },
  '/api/v1/admin/orders/{id}/reprint': {
    post: op({
      tags: ['Orders'],
      summary: 'Reprint the kitchen ticket',
      auth: 'bearer',
      params: pathParam('id'),
    }),
  },

  // Admin tables
  '/api/v1/admin/tables': {
    get: op({ tags: ['Tables'], summary: 'List tables', auth: 'bearer' }),
    post: op({
      tags: ['Tables'],
      summary: 'Create a table',
      auth: 'bearer',
      body: createTableSchema,
      status: 201,
    }),
  },
  '/api/v1/admin/tables/{id}': {
    patch: op({
      tags: ['Tables'],
      summary: 'Update a table',
      auth: 'bearer',
      params: pathParam('id'),
      body: updateTableSchema,
    }),
    delete: op({
      tags: ['Tables'],
      summary: 'Delete a table',
      auth: 'bearer',
      params: pathParam('id'),
    }),
  },

  // Floor & sessions
  '/api/v1/admin/floor': {
    get: op({
      tags: ['Floor & Sessions'],
      summary: 'Live floor (tables + open tabs)',
      auth: 'bearer',
    }),
  },
  '/api/v1/admin/sessions': {
    get: op({
      tags: ['Floor & Sessions'],
      summary: 'List sessions (tabs)',
      auth: 'bearer',
      params: { query: sessionListQuerySchema },
    }),
  },
  '/api/v1/admin/sessions/{id}': {
    get: op({
      tags: ['Floor & Sessions'],
      summary: 'Session detail',
      auth: 'bearer',
      params: pathParam('id'),
    }),
  },
  '/api/v1/admin/sessions/{id}/pax': {
    patch: op({
      tags: ['Floor & Sessions'],
      summary: 'Set covers (pax)',
      auth: 'bearer',
      params: pathParam('id'),
      body: sessionPaxSchema,
    }),
  },
  '/api/v1/admin/sessions/{id}/close': {
    post: op({
      tags: ['Floor & Sessions'],
      summary: 'Close a tab with payment',
      auth: 'bearer',
      params: pathParam('id'),
      body: closeSessionSchema,
    }),
  },
  '/api/v1/admin/sessions/{id}/cancel': {
    post: op({
      tags: ['Floor & Sessions'],
      summary: 'Cancel a tab',
      auth: 'bearer',
      params: pathParam('id'),
    }),
  },
  '/api/v1/admin/sessions/{id}/move': {
    post: op({
      tags: ['Floor & Sessions'],
      summary: 'Move a tab to another table',
      auth: 'bearer',
      params: pathParam('id'),
      body: moveSessionSchema,
    }),
  },
  '/api/v1/admin/sessions/{id}/combine': {
    post: op({
      tags: ['Floor & Sessions'],
      summary: 'Combine two tabs',
      auth: 'bearer',
      params: pathParam('id'),
      body: combineSessionSchema,
    }),
  },
  '/api/v1/admin/sessions/{id}/reopen': {
    post: op({
      tags: ['Floor & Sessions'],
      summary: 'Reopen a closed tab',
      auth: 'bearer',
      params: pathParam('id'),
    }),
  },

  // Reports
  '/api/v1/admin/reports/sales': {
    get: op({
      tags: ['Reports'],
      summary: 'Sales (Z-reading) report',
      auth: 'bearer',
      params: { query: salesReportQuerySchema },
    }),
  },

  // Settings
  '/api/v1/admin/settings': {
    get: op({ tags: ['Settings'], summary: 'Store settings', auth: 'bearer' }),
    patch: op({
      tags: ['Settings'],
      summary: 'Update store settings',
      auth: 'bearer',
      body: settingsUpdateSchema,
    }),
  },
  '/api/v1/admin/settings/pin': {
    post: op({
      tags: ['Settings'],
      summary: 'Set the override PIN',
      auth: 'bearer',
      body: setPinSchema,
    }),
  },
  '/api/v1/admin/settings/pin/verify': {
    post: op({
      tags: ['Settings'],
      summary: 'Verify the override PIN',
      auth: 'bearer',
      body: verifyPinSchema,
    }),
  },

  // Vouchers
  '/api/v1/admin/vouchers': {
    get: op({ tags: ['Vouchers'], summary: 'List vouchers', auth: 'bearer' }),
    post: op({
      tags: ['Vouchers'],
      summary: 'Create a voucher',
      auth: 'bearer',
      body: createVoucherSchema,
      status: 201,
    }),
  },
  '/api/v1/admin/vouchers/{id}': {
    patch: op({
      tags: ['Vouchers'],
      summary: 'Update a voucher',
      auth: 'bearer',
      params: pathParam('id'),
      body: updateVoucherSchema,
    }),
    delete: op({
      tags: ['Vouchers'],
      summary: 'Delete a voucher',
      auth: 'bearer',
      params: pathParam('id'),
    }),
  },

  // Loyalty
  '/api/v1/admin/loyalty/config': {
    get: op({ tags: ['Loyalty'], summary: 'Loyalty program config', auth: 'bearer' }),
    patch: op({
      tags: ['Loyalty'],
      summary: 'Update loyalty config',
      auth: 'bearer',
      body: loyaltyConfigSchema,
    }),
  },
  '/api/v1/admin/loyalty/members': {
    get: op({
      tags: ['Loyalty'],
      summary: 'List/search members',
      auth: 'bearer',
      params: { query: memberSearchQuery },
    }),
    post: op({
      tags: ['Loyalty'],
      summary: 'Create a member',
      auth: 'bearer',
      body: createMemberSchema,
      status: 201,
    }),
  },
  '/api/v1/admin/loyalty/members/{id}': {
    get: op({
      tags: ['Loyalty'],
      summary: 'Member detail',
      auth: 'bearer',
      params: pathParam('id'),
    }),
    patch: op({
      tags: ['Loyalty'],
      summary: 'Update a member',
      auth: 'bearer',
      params: pathParam('id'),
      body: updateMemberSchema,
    }),
    delete: op({
      tags: ['Loyalty'],
      summary: 'Delete a member',
      auth: 'bearer',
      params: pathParam('id'),
    }),
  },
  '/api/v1/admin/loyalty/members/{id}/adjust': {
    post: op({
      tags: ['Loyalty'],
      summary: 'Adjust a member’s points',
      auth: 'bearer',
      params: pathParam('id'),
      body: adjustPointsSchema,
    }),
  },
  '/api/v1/admin/loyalty/rewards': {
    get: op({ tags: ['Loyalty'], summary: 'List rewards', auth: 'bearer' }),
    post: op({
      tags: ['Loyalty'],
      summary: 'Create a reward',
      auth: 'bearer',
      body: createRewardSchema,
      status: 201,
    }),
  },
  '/api/v1/admin/loyalty/rewards/{id}': {
    patch: op({
      tags: ['Loyalty'],
      summary: 'Update a reward',
      auth: 'bearer',
      params: pathParam('id'),
      body: updateRewardSchema,
    }),
    delete: op({
      tags: ['Loyalty'],
      summary: 'Delete a reward',
      auth: 'bearer',
      params: pathParam('id'),
    }),
  },

  // Platform (super-admin)
  '/api/v1/admin/platform/plans': {
    get: op({ tags: ['Platform'], summary: 'List subscription plans', auth: 'platform' }),
  },
  '/api/v1/admin/platform/plans/{key}': {
    patch: op({
      tags: ['Platform'],
      summary: 'Update a plan',
      auth: 'platform',
      params: pathParam('key'),
      body: updatePlanSchema,
    }),
  },
  '/api/v1/admin/platform/audit': {
    get: op({
      tags: ['Platform'],
      summary: 'Operator audit log',
      auth: 'platform',
      params: { query: auditQuerySchema },
    }),
  },
  '/api/v1/admin/platform/clients': {
    get: op({ tags: ['Platform'], summary: 'List clients', auth: 'platform' }),
    post: op({
      tags: ['Platform'],
      summary: 'Create a client + first outlet',
      auth: 'platform',
      body: createClientSchema,
      status: 201,
    }),
  },
  '/api/v1/admin/platform/clients/{id}': {
    get: op({
      tags: ['Platform'],
      summary: 'Client detail + outlets',
      auth: 'platform',
      params: pathParam('id'),
    }),
    patch: op({
      tags: ['Platform'],
      summary: 'Update a client',
      auth: 'platform',
      params: pathParam('id'),
      body: updateClientSchema,
    }),
  },
  '/api/v1/admin/platform/clients/{id}/outlets': {
    post: op({
      tags: ['Platform'],
      summary: 'Add an outlet to a client',
      auth: 'platform',
      params: pathParam('id'),
      body: addOutletSchema,
      status: 201,
    }),
  },
  '/api/v1/admin/platform/clients/{id}/apply-plan': {
    post: op({
      tags: ['Platform'],
      summary: 'Apply a plan to a client',
      auth: 'platform',
      params: pathParam('id'),
      body: applyPlanSchema,
    }),
  },
  '/api/v1/admin/platform/outlets/{storeId}': {
    patch: op({
      tags: ['Platform'],
      summary: 'Update an outlet',
      auth: 'platform',
      params: pathParam('storeId'),
      body: updateOutletSchema,
    }),
  },
  '/api/v1/admin/platform/outlets/{storeId}/impersonate': {
    post: op({
      tags: ['Platform'],
      summary: 'Mint an impersonation (view-as) token for an outlet',
      auth: 'platform',
      params: pathParam('storeId'),
    }),
  },

  // Outlet switching (client owner)
  '/api/v1/admin/outlets': {
    get: op({ tags: ['Outlets'], summary: 'List sibling outlets', auth: 'bearer' }),
  },
  '/api/v1/admin/outlets/{storeId}/switch': {
    post: op({
      tags: ['Outlets'],
      summary: 'Switch to a sibling outlet (new scoped JWT)',
      auth: 'bearer',
      params: pathParam('storeId'),
    }),
  },

  // Menu — categories
  '/api/v1/admin/menu/categories': {
    get: op({ tags: ['Menu'], summary: 'List categories', auth: 'bearer' }),
    post: op({
      tags: ['Menu'],
      summary: 'Create a category',
      auth: 'bearer',
      body: createCategorySchema,
      status: 201,
    }),
  },
  '/api/v1/admin/menu/categories/reorder': {
    patch: op({
      tags: ['Menu'],
      summary: 'Reorder categories',
      auth: 'bearer',
      body: reorderSchema,
    }),
  },
  '/api/v1/admin/menu/categories/{id}': {
    patch: op({
      tags: ['Menu'],
      summary: 'Update a category',
      auth: 'bearer',
      params: pathParam('id'),
      body: updateCategorySchema,
    }),
    delete: op({
      tags: ['Menu'],
      summary: 'Delete a category',
      auth: 'bearer',
      params: pathParam('id'),
    }),
  },

  // Menu — items
  '/api/v1/admin/menu/items': {
    get: op({
      tags: ['Menu'],
      summary: 'List items',
      auth: 'bearer',
      params: { query: itemsQuery },
    }),
    post: op({
      tags: ['Menu'],
      summary: 'Create an item',
      auth: 'bearer',
      body: createItemSchema,
      status: 201,
    }),
  },
  '/api/v1/admin/menu/items/reorder': {
    patch: op({ tags: ['Menu'], summary: 'Reorder items', auth: 'bearer', body: reorderSchema }),
  },
  '/api/v1/admin/menu/items/featured/reorder': {
    patch: op({
      tags: ['Menu'],
      summary: 'Reorder featured items',
      auth: 'bearer',
      body: reorderSchema,
    }),
  },
  '/api/v1/admin/menu/items/{id}': {
    patch: op({
      tags: ['Menu'],
      summary: 'Update an item',
      auth: 'bearer',
      params: pathParam('id'),
      body: updateItemSchema,
    }),
    delete: op({
      tags: ['Menu'],
      summary: 'Delete an item',
      auth: 'bearer',
      params: pathParam('id'),
    }),
  },
  '/api/v1/admin/menu/items/{id}/sold-out': {
    patch: op({
      tags: ['Menu'],
      summary: 'Toggle sold-out',
      auth: 'bearer',
      params: pathParam('id'),
      body: soldOutSchema,
    }),
  },
  '/api/v1/admin/menu/items/{id}/move': {
    patch: op({
      tags: ['Menu'],
      summary: 'Move an item to another category',
      auth: 'bearer',
      params: pathParam('id'),
      body: moveItemSchema,
    }),
  },
  '/api/v1/admin/menu/items/{id}/feature': {
    patch: op({
      tags: ['Menu'],
      summary: 'Feature / unfeature an item',
      auth: 'bearer',
      params: pathParam('id'),
      body: featureSchema,
    }),
  },
  '/api/v1/admin/menu/settings': {
    get: op({ tags: ['Menu'], summary: 'Menu settings', auth: 'bearer' }),
    patch: op({
      tags: ['Menu'],
      summary: 'Update menu settings',
      auth: 'bearer',
      body: menuSettingsSchema,
    }),
  },

  // Uploads
  '/api/v1/admin/uploads/image': {
    post: op({
      tags: ['Uploads'],
      summary: 'Upload an item image',
      auth: 'bearer',
      multipart: uploadBody,
      status: 201,
    }),
  },

  // Print agent (shared-secret)
  '/api/v1/print-agent/jobs/pending': {
    get: op({ tags: ['Print Agent'], summary: 'Poll due print jobs', auth: 'printAgent' }),
  },
  '/api/v1/print-agent/jobs/{id}/mark-printing': {
    post: op({
      tags: ['Print Agent'],
      summary: 'Mark a job as printing',
      auth: 'printAgent',
      params: pathParam('id'),
    }),
  },
  '/api/v1/print-agent/jobs/{id}/mark-printed': {
    post: op({
      tags: ['Print Agent'],
      summary: 'Mark a job as printed',
      auth: 'printAgent',
      params: pathParam('id'),
    }),
  },
  '/api/v1/print-agent/jobs/{id}/mark-failed': {
    post: op({
      tags: ['Print Agent'],
      summary: 'Mark a job as failed (queues a retry)',
      auth: 'printAgent',
      params: pathParam('id'),
      body: markFailedSchema,
    }),
  },
};

export const openapiDocument = createDocument({
  openapi: '3.1.0',
  info: {
    title: 'QR Ordering API',
    version: '1.0.0',
    description:
      'Multi-tenant restaurant ordering & POS platform API. Every response uses a ' +
      '`{ success: true, data }` envelope on success and `{ success: false, error }` on error. ' +
      'Money fields are numbers; dates are ISO 8601 strings.',
  },
  servers: [{ url: '/', description: 'This server' }],
  tags: [
    { name: 'Public', description: 'Customer-facing, no auth' },
    { name: 'Orders', description: 'Customer + staff order entry' },
    { name: 'Auth', description: 'Admin authentication' },
    { name: 'Floor & Sessions', description: 'Live floor and table tabs' },
    { name: 'Tables', description: 'Table management' },
    { name: 'Menu', description: 'Categories, items, options, featured' },
    { name: 'Settings', description: 'Store settings + override PIN' },
    { name: 'Reports', description: 'Z-reading / sales reports' },
    { name: 'Vouchers', description: 'Discount vouchers' },
    { name: 'Loyalty', description: 'Members, points, rewards' },
    { name: 'Billing', description: 'Stripe subscription (account area)' },
    { name: 'Outlets', description: 'Switch between sibling outlets' },
    { name: 'Platform', description: 'Super-admin: clients, outlets, plans, audit, impersonation' },
    { name: 'Uploads', description: 'Image uploads' },
    { name: 'Print Agent', description: 'Local print agent (shared-secret) job queue' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Admin JWT from POST /api/v1/admin/auth/login. Platform routes also require a platform-admin token.',
      },
      printAgentKey: {
        type: 'apiKey',
        in: 'header',
        name: 'x-print-agent-key',
        description: 'Shared secret used by the local print agent.',
      },
    },
  },
  paths,
});
