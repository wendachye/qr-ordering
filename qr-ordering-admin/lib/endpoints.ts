// Typed endpoint helpers built on top of apiRequest.

import { apiRequest } from "./api";
import type {
  AuthUser,
  Billing,
  Entitlements,
  Category,
  CategoryInput,
  Combo,
  ComboInput,
  EinvoiceSettings,
  EinvoiceSettingsInput,
  Invoice,
  InvoiceBuyerInput,
  InvoiceList,
  SalesReport,
  DiscountType,
  LoginResponse,
  MenuItem,
  MenuItemInput,
  MenuSettings,
  OrderDetail,
  OrderStatus,
  OrderSummary,
  PlanDef,
  PlanInput,
  Client,
  CreateClientInput,
  UpdateClientInput,
  AddOutletInput,
  UpdateOutletInput,
  ApplyPlanInput,
  AuditList,
  MyOutletsResponse,
  SwitchOutletResponse,
  ImpersonateResponse,
  TableOrder,
  PlaceOrderInput,
  PlaceOrderResponse,
  PrintHealth,
  PublicMenu,
  ReprintResponse,
  Role,
  Settings,
  StaffMember,
  StockLedgerEntry,
  Table,
  TableInput,
  FloorEntry,
  SessionDetail,
  SessionStatus,
  SessionSummary,
  Voucher,
  VoucherInput,
} from "./types";

// --- Billing (Stripe) ---
export const billingApi = {
  get: () => apiRequest<Billing>("/admin/billing"),
  checkout: (plan: string) =>
    apiRequest<{ url: string | null }>("/admin/billing/checkout", { method: "POST", body: { plan } }),
  portal: () => apiRequest<{ url: string | null }>("/admin/billing/portal", { method: "POST" }),
  apply: (plan: string) =>
    apiRequest<Billing>("/admin/billing/apply", { method: "POST", body: { plan } }),
};

// --- Entitlements (resolved plan features + limits + usage for the current tenant) ---
export const entitlementsApi = {
  get: () => apiRequest<Entitlements>("/admin/entitlements"),
};

// --- Platform plans (super-admin: configure Basic/Pro) ---
export const platformPlansApi = {
  list: () => apiRequest<PlanDef[]>("/admin/platform/plans"),
  update: (key: string, input: PlanInput) =>
    apiRequest<PlanDef[]>(`/admin/platform/plans/${key}`, { method: "PATCH", body: input }),
};

// --- Platform clients + outlets (super-admin console) ---
export const platformClientsApi = {
  list: () => apiRequest<Client[]>("/admin/platform/clients"),
  get: (id: string) => apiRequest<Client>(`/admin/platform/clients/${id}`),
  create: (input: CreateClientInput) =>
    apiRequest<Client>("/admin/platform/clients", { method: "POST", body: input }),
  update: (id: string, input: UpdateClientInput) =>
    apiRequest<Client>(`/admin/platform/clients/${id}`, { method: "PATCH", body: input }),
  addOutlet: (id: string, input: AddOutletInput) =>
    apiRequest<Client>(`/admin/platform/clients/${id}/outlets`, { method: "POST", body: input }),
  applyPlan: (id: string, input: ApplyPlanInput) =>
    apiRequest<Client>(`/admin/platform/clients/${id}/apply-plan`, { method: "POST", body: input }),
};

export const platformOutletsApi = {
  update: (storeId: string, input: UpdateOutletInput) =>
    apiRequest<Client>(`/admin/platform/outlets/${storeId}`, { method: "PATCH", body: input }),
  impersonate: (storeId: string) =>
    apiRequest<ImpersonateResponse>(`/admin/platform/outlets/${storeId}/impersonate`, {
      method: "POST",
    }),
};

// --- Operator audit log (super-admin console) ---
export const platformAuditApi = {
  list: (params?: { action?: string; entity?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.action) qs.set("action", params.action);
    if (params?.entity) qs.set("entity", params.entity);
    if (params?.limit != null) qs.set("limit", String(params.limit));
    if (params?.offset != null) qs.set("offset", String(params.offset));
    const q = qs.toString();
    return apiRequest<AuditList>(`/admin/platform/audit${q ? `?${q}` : ""}`);
  },
};

// --- Outlets (a client owner switching between their own outlets) ---
export const outletsApi = {
  mine: () => apiRequest<MyOutletsResponse>("/admin/outlets"),
  switch: (storeId: string) =>
    apiRequest<SwitchOutletResponse>(`/admin/outlets/${storeId}/switch`, { method: "POST" }),
};

// --- Auth ---
export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<LoginResponse>("/admin/auth/login", {
      method: "POST",
      body: { email, password },
      skipAuthRedirect: true,
    }),
  me: () => apiRequest<AuthUser>("/admin/auth/me", { skipAuthRedirect: true }),
  // Re-confirm the admin's password (gates a price override). Returns { ok }.
  verifyPassword: (password: string) =>
    apiRequest<{ ok: boolean }>("/admin/auth/verify-password", {
      method: "POST",
      body: { password },
    }),
};

// --- Orders ---
export const ordersApi = {
  // Staff order entry — supports price override + takeaway (admin-authenticated).
  create: (input: PlaceOrderInput, idempotencyKey?: string) =>
    apiRequest<PlaceOrderResponse>("/admin/orders", { method: "POST", body: input, idempotencyKey }),
  // Void one item on an open tab; returns the refreshed session.
  voidItem: (itemId: string, reason?: string, pin?: string) =>
    apiRequest<SessionDetail>(`/admin/orders/items/${itemId}/void`, {
      method: "POST",
      body: { reason, pin },
    }),
  list: (status?: OrderStatus) =>
    apiRequest<OrderSummary[]>(
      `/admin/orders${status ? `?status=${status}` : ""}`
    ),
  get: (id: string) => apiRequest<OrderDetail>(`/admin/orders/${id}`),
  setStatus: (id: string, status: OrderStatus) =>
    apiRequest<OrderDetail>(`/admin/orders/${id}/status`, {
      method: "PATCH",
      body: { status },
    }),
  reprint: (id: string) =>
    apiRequest<ReprintResponse>(`/admin/orders/${id}/reprint`, {
      method: "POST",
    }),
  byTable: (tableId: string) =>
    apiRequest<TableOrder[]>(`/admin/orders/table/${tableId}`),
  // Kitchen-printing health (failed/stuck tickets) for the current tenant.
  printHealth: () => apiRequest<PrintHealth>("/admin/orders/print-health"),
};

// --- Tables ---
export const tablesApi = {
  list: () => apiRequest<Table[]>("/admin/tables"),
  create: (input: TableInput) =>
    apiRequest<Table>("/admin/tables", { method: "POST", body: input }),
  update: (id: string, input: Partial<TableInput>) =>
    apiRequest<Table>(`/admin/tables/${id}`, { method: "PATCH", body: input }),
  remove: (id: string) =>
    apiRequest<{ id: string }>(`/admin/tables/${id}`, { method: "DELETE" }),
};

// --- Sessions (floor view + running tabs) ---
export const sessionsApi = {
  floor: () => apiRequest<FloorEntry[]>("/admin/floor"),
  get: (id: string) => apiRequest<SessionDetail>(`/admin/sessions/${id}`),
  close: (
    id: string,
    paymentMethod: string,
    discount?: { discountType: DiscountType; discountValue: number },
    voucherCode?: string,
    tip?: number
  ) =>
    apiRequest<SessionDetail>(`/admin/sessions/${id}/close`, {
      method: "POST",
      body: {
        paymentMethod,
        ...(discount ?? {}),
        ...(voucherCode !== undefined ? { voucherCode } : {}),
        ...(tip && tip > 0 ? { tip } : {}),
      },
    }),
  // Record a tender (full or partial/split). Omit `amount` to settle the whole
  // remaining balance; a smaller amount keeps the tab open with a balance owing.
  pay: (
    id: string,
    input: {
      paymentMethod: string;
      amount?: number;
      tip?: number;
      tendered?: number;
      reference?: string;
      discount?: { discountType: DiscountType; discountValue: number };
      voucherCode?: string;
    }
  ) =>
    apiRequest<SessionDetail>(`/admin/sessions/${id}/pay`, {
      method: "POST",
      body: {
        paymentMethod: input.paymentMethod,
        ...(input.amount != null ? { amount: input.amount } : {}),
        ...(input.tip && input.tip > 0 ? { tip: input.tip } : {}),
        ...(input.tendered != null ? { tendered: input.tendered } : {}),
        ...(input.reference ? { reference: input.reference } : {}),
        ...(input.discount ?? {}),
        ...(input.voucherCode !== undefined ? { voucherCode: input.voucherCode } : {}),
      },
    }),
  cancel: (id: string) =>
    apiRequest<SessionDetail>(`/admin/sessions/${id}/cancel`, { method: "POST" }),
  reopen: (id: string) =>
    apiRequest<SessionDetail>(`/admin/sessions/${id}/reopen`, { method: "POST" }),
  // Move this tab to another free table.
  move: (id: string, targetTableId: string) =>
    apiRequest<SessionDetail>(`/admin/sessions/${id}/move`, {
      method: "POST",
      body: { targetTableId },
    }),
  // Combine another open tab (sourceSessionId) into this one.
  combine: (id: string, sourceSessionId: string) =>
    apiRequest<SessionDetail>(`/admin/sessions/${id}/combine`, {
      method: "POST",
      body: { sourceSessionId },
    }),
  setPax: (id: string, pax: number) =>
    apiRequest<SessionDetail>(`/admin/sessions/${id}/pax`, {
      method: "PATCH",
      body: { pax },
    }),
  history: (status?: SessionStatus, tableId?: string) => {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (tableId) qs.set("tableId", tableId);
    const q = qs.toString();
    return apiRequest<SessionSummary[]>(`/admin/sessions${q ? `?${q}` : ""}`);
  },
};

// --- Public menu + placing an order (staff POS) ---
// These hit the PUBLIC endpoints; apiRequest still attaches the bearer token
// (harmless for public routes) and unwraps the envelope the same way.
// Staff POS menu — same shape as the customer menu, but includes POS-only
// ("secret") items. Used by the admin order screens instead of publicApi.menu.
export const posMenuApi = {
  get: (tableCode: string) =>
    apiRequest<PublicMenu>(`/admin/menu/pos-menu?tableCode=${encodeURIComponent(tableCode)}`),
};

export const publicApi = {
  menu: (tableCode: string) =>
    apiRequest<PublicMenu>(
      `/public/menu?tableCode=${encodeURIComponent(tableCode)}`
    ),
  placeOrder: (input: PlaceOrderInput, idempotencyKey?: string) =>
    apiRequest<PlaceOrderResponse>("/orders", { method: "POST", body: input, idempotencyKey }),
};

// --- Categories ---
export const categoriesApi = {
  list: () => apiRequest<Category[]>("/admin/menu/categories"),
  create: (input: CategoryInput) =>
    apiRequest<Category>("/admin/menu/categories", {
      method: "POST",
      body: input,
    }),
  update: (id: string, input: Partial<CategoryInput>) =>
    apiRequest<Category>(`/admin/menu/categories/${id}`, {
      method: "PATCH",
      body: input,
    }),
  reorder: (ids: string[]) =>
    apiRequest<Category[]>("/admin/menu/categories/reorder", {
      method: "PATCH",
      body: { ids },
    }),
  remove: (id: string) =>
    apiRequest<{ id: string }>(`/admin/menu/categories/${id}`, {
      method: "DELETE",
    }),
};

// --- Items ---
export const itemsApi = {
  list: (categoryId?: string) =>
    apiRequest<MenuItem[]>(
      `/admin/menu/items${categoryId ? `?categoryId=${categoryId}` : ""}`
    ),
  create: (input: MenuItemInput) =>
    apiRequest<MenuItem>("/admin/menu/items", {
      method: "POST",
      body: input,
    }),
  update: (id: string, input: Partial<MenuItemInput>) =>
    apiRequest<MenuItem>(`/admin/menu/items/${id}`, {
      method: "PATCH",
      body: input,
    }),
  remove: (id: string) =>
    apiRequest<{ id: string }>(`/admin/menu/items/${id}`, {
      method: "DELETE",
    }),
  reorder: (ids: string[]) =>
    apiRequest<MenuItem[]>("/admin/menu/items/reorder", {
      method: "PATCH",
      body: { ids },
    }),
  move: (id: string, categoryId: string) =>
    apiRequest<MenuItem[]>(`/admin/menu/items/${id}/move`, {
      method: "PATCH",
      body: { categoryId },
    }),
  setFeatured: (id: string, isFeatured: boolean) =>
    apiRequest<MenuItem[]>(`/admin/menu/items/${id}/feature`, {
      method: "PATCH",
      body: { isFeatured },
    }),
  reorderFeatured: (ids: string[]) =>
    apiRequest<MenuItem[]>("/admin/menu/items/featured/reorder", {
      method: "PATCH",
      body: { ids },
    }),
  setSoldOut: (id: string, isAvailable: boolean) =>
    apiRequest<MenuItem>(`/admin/menu/items/${id}/sold-out`, {
      method: "PATCH",
      body: { isAvailable },
    }),
};

// --- Combos / set meals ---
export const combosApi = {
  list: () => apiRequest<Combo[]>("/admin/menu/combos"),
  create: (input: ComboInput) =>
    apiRequest<Combo>("/admin/menu/combos", { method: "POST", body: input }),
  update: (id: string, input: Partial<ComboInput>) =>
    apiRequest<Combo>(`/admin/menu/combos/${id}`, { method: "PATCH", body: input }),
  remove: (id: string) =>
    apiRequest<{ id: string }>(`/admin/menu/combos/${id}`, { method: "DELETE" }),
};

// --- Inventory (stock tracking + adjustments + ledger) ---
export const inventoryApi = {
  // Restock (+delta) or waste (−delta). Returns the new count + availability.
  adjust: (
    id: string,
    input: { delta: number; reason: "restock" | "waste"; note?: string }
  ) =>
    apiRequest<{ id: string; stockQty: number; isAvailable: boolean }>(
      `/admin/inventory/${id}/adjust`,
      { method: "POST", body: input }
    ),
  // Turn tracking on/off, set the absolute count + low-stock threshold.
  config: (
    id: string,
    input: { trackStock?: boolean; stockQty?: number; lowStockThreshold?: number | null }
  ) =>
    apiRequest<{ id: string }>(`/admin/inventory/${id}/config`, {
      method: "PATCH",
      body: input,
    }),
  // Recent stock movements, newest first.
  ledger: (id: string) =>
    apiRequest<StockLedgerEntry[]>(`/admin/inventory/${id}/ledger`),
  // Items at or below their low-stock threshold (or out of stock).
  lowStock: () =>
    apiRequest<
      {
        id: string;
        name: string;
        stockQty: number;
        lowStockThreshold: number | null;
        isAvailable: boolean;
      }[]
    >("/admin/inventory/low-stock"),
};

// --- Menu settings (featured section title + takeaway charge) ---
export const menuSettingsApi = {
  get: () => apiRequest<MenuSettings>("/admin/menu/settings"),
  update: (featuredTitle: string) =>
    apiRequest<MenuSettings>("/admin/menu/settings", {
      method: "PATCH",
      body: { featuredTitle },
    }),
  setFeaturedEnabled: (featuredEnabled: boolean) =>
    apiRequest<MenuSettings>("/admin/menu/settings", {
      method: "PATCH",
      body: { featuredEnabled },
    }),
  // Customer-menu hero banner (image list / title / subtitle). Pass [] / null to clear.
  updateBanner: (input: {
    bannerImageUrls?: string[];
    bannerTitle?: string | null;
    bannerSubtitle?: string | null;
  }) =>
    apiRequest<MenuSettings>("/admin/menu/settings", {
      method: "PATCH",
      body: input,
    }),
  setTakeawayCharge: (takeawayCharge: number) =>
    apiRequest<MenuSettings>("/admin/menu/settings", {
      method: "PATCH",
      body: { takeawayCharge },
    }),
};

// --- Settings (store-level + override PIN) ---
export const settingsApi = {
  get: () => apiRequest<Settings>("/admin/settings"),
  update: (input: {
    storeName?: string;
    logoUrl?: string | null;
    takeawayCharge?: number;
    serviceChargeRate?: number;
    taxes?: { name: string; rate: number }[];
    featuredTitle?: string;
    voidPinRequired?: boolean;
    discountPinRequired?: boolean;
    overridePinRequired?: boolean;
    paymentMethods?: string[];
  }) =>
    apiRequest<Settings>("/admin/settings", { method: "PATCH", body: input }),
  // Set/change the override PIN — needs the admin password. Returns { ok }.
  setPin: (currentPassword: string, pin: string) =>
    apiRequest<{ ok: boolean }>("/admin/settings/pin", {
      method: "POST",
      body: { currentPassword, pin },
    }),
  // Authorise a price override. Returns { ok, configured }.
  verifyPin: (pin: string) =>
    apiRequest<{ ok: boolean; configured: boolean }>(
      "/admin/settings/pin/verify",
      { method: "POST", body: { pin } }
    ),
};

// --- Staff accounts (RBAC) ---
export const staffApi = {
  list: () => apiRequest<StaffMember[]>("/admin/staff"),
  create: (input: { email: string; password: string; name?: string; role: Role }) =>
    apiRequest<StaffMember>("/admin/staff", { method: "POST", body: input }),
  update: (id: string, input: { name?: string | null; role?: Role; isActive?: boolean }) =>
    apiRequest<StaffMember>(`/admin/staff/${id}`, { method: "PATCH", body: input }),
};

// --- Vouchers (discount / promo codes) ---
export const vouchersApi = {
  list: () => apiRequest<Voucher[]>("/admin/vouchers"),
  create: (input: VoucherInput) =>
    apiRequest<Voucher>("/admin/vouchers", { method: "POST", body: input }),
  update: (id: string, input: Partial<VoucherInput>) =>
    apiRequest<Voucher>(`/admin/vouchers/${id}`, { method: "PATCH", body: input }),
  remove: (id: string) =>
    apiRequest<{ id: string; deactivated: boolean }>(`/admin/vouchers/${id}`, { method: "DELETE" }),
};

// --- Malaysia e-Invoice (MyInvois) ---
// Settings routes need "settings:manage"; invoice routes need "reports:view".
export const einvoiceApi = {
  getSettings: () => apiRequest<EinvoiceSettings>("/admin/einvoice/settings"),
  updateSettings: (input: EinvoiceSettingsInput) =>
    apiRequest<EinvoiceSettings>("/admin/einvoice/settings", { method: "PATCH", body: input }),
  listInvoices: (params?: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.limit != null) qs.set("limit", String(params.limit));
    if (params?.offset != null) qs.set("offset", String(params.offset));
    const q = qs.toString();
    return apiRequest<InvoiceList>(`/admin/einvoice/invoices${q ? `?${q}` : ""}`);
  },
  getInvoice: (id: string) => apiRequest<Invoice>(`/admin/einvoice/invoices/${id}`),
  submitInvoice: (id: string) =>
    apiRequest<Invoice>(`/admin/einvoice/invoices/${id}/submit`, { method: "POST" }),
  // The issued invoice for a settled tab, or null if none has been issued yet.
  sessionInvoice: (sessionId: string) =>
    apiRequest<Invoice | null>(`/admin/einvoice/sessions/${sessionId}/invoice`),
  issueForSession: (sessionId: string, buyer: InvoiceBuyerInput) =>
    apiRequest<Invoice>(`/admin/einvoice/sessions/${sessionId}/issue`, {
      method: "POST",
      body: buyer,
    }),
};

// --- Reports ---
export const reportsApi = {
  // from/to are inclusive business days (YYYY-MM-DD). Omit for "today".
  sales: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return apiRequest<SalesReport>(`/admin/reports/sales${qs ? `?${qs}` : ""}`);
  },
};
