// Shared types mirroring the backend API contract.

export type OrderStatus = "NEW" | "COMPLETED" | "CANCELLED";

export type PrintStatus = "PENDING" | "PRINTING" | "PRINTED" | "FAILED" | null;

// Staff role within the store (RBAC).
export type Role = "OWNER" | "MANAGER" | "CASHIER" | "WAITER";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  // Staff role (RBAC) — drives nav gating; the backend is the real enforcement.
  role?: Role;
  // Platform operator (owner) — can edit the global subscription plans.
  isPlatformAdmin?: boolean;
  // Set when this is an impersonation session: the operator's email.
  imp?: string | null;
}

// One staff account (GET /admin/staff).
export interface StaffMember {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

// --- Subscription plans (platform super-admin config) ---
export interface PlanDef {
  key: string;
  name: string;
  description: string | null;
  monthlyPrice: number;
  currency: string;
  stripePriceId: string | null;
  features: string[]; // loyalty | vouchers | reports_advanced | tax_multi
  maxTables: number | null; // null = unlimited
  maxMenuItems: number | null; // null = unlimited
  sortOrder: number;
  isActive: boolean;
}

export type PlanInput = Partial<Omit<PlanDef, "key">>;

// --- Platform clients + outlets (super-admin console) ---
export interface Outlet {
  id: string;
  name: string;
  slug: string;
  plan: string | null;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  isActive: boolean;
  tableCount: number;
  menuItemCount: number;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  outletCount: number;
  outlets: Outlet[];
}

export type PlanKey = "basic" | "pro";
export type SubStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";

export interface CreateClientInput {
  clientName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
  outletName: string;
  adminEmail?: string;
  adminPassword?: string;
  planKey: PlanKey;
  trialDays?: number;
}
export type UpdateClientInput = Partial<
  Pick<Client, "name" | "contactEmail" | "contactPhone" | "notes" | "isActive">
>;
export interface AddOutletInput {
  outletName: string;
  adminEmail?: string;
  adminPassword?: string;
  planKey: PlanKey;
  trialDays?: number;
}
export interface UpdateOutletInput {
  name?: string;
  plan?: PlanKey;
  subscriptionStatus?: SubStatus;
  trialEndsAt?: string | null;
  isActive?: boolean;
}
export interface ApplyPlanInput {
  planKey: PlanKey;
  subscriptionStatus?: SubStatus;
  trialDays?: number;
}
export interface ImpersonateResponse {
  token: string;
  outlet: { id: string; name: string };
}

// --- Operator audit log (super-admin console) ---
export interface AuditEntry {
  id: string;
  actorId: string | null;
  actorEmail: string;
  actorImp: string | null; // operator email when done under impersonation
  action: string;
  entity: string;
  entityId: string | null;
  storeId: string | null;
  summary: string | null;
  metadata: unknown;
  requestId: string | null;
  ip: string | null;
  createdAt: string;
}

export interface AuditList {
  total: number;
  limit: number;
  offset: number;
  entries: AuditEntry[];
}

// --- Outlet switcher (a client owner moving between their own outlets) ---
export interface MyOutlet {
  id: string;
  name: string;
  current: boolean;
}
export interface MyOutletsResponse {
  clientName: string | null;
  currentStoreId: string;
  outlets: MyOutlet[];
}
export interface SwitchOutletResponse {
  token: string;
  outlet: { id: string; name: string };
}

// GET /admin/orders list element
export interface OrderSummary {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  tableName: string;
  totalItems: number;
  total: number;
  printStatus: PrintStatus;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  note: string | null;
}

export interface PrintJob {
  id: string;
  status: Exclude<PrintStatus, null>;
  error: string | null;
  retryCount: number;
  createdAt: string;
  printedAt: string | null;
}

// GET /admin/orders/:id
export interface OrderDetail {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  note: string | null;
  tableId: string;
  tableName: string;
  tableCode: string;
  subtotal: number;
  total: number;
  totalItems: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  printJobs: PrintJob[];
}

export interface ReprintResponse {
  printJobId: string;
  status: string;
}

// GET /admin/menu/categories element
export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryInput {
  name: string;
  // Optional: order is managed by drag-and-drop; backend appends new ones.
  sortOrder?: number;
  isActive: boolean;
}

// GET /admin/menu/items element
export interface MenuItem {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string | null;
  imageUrls: string[];
  tags: string[];
  price: number;
  // Standing menu discount (shown on the customer menu + charged on order).
  discountType: DiscountType | null;
  discountValue: number;
  salePrice: number | null;
  isAvailable: boolean;
  // POS-only ("secret") item: hidden from the customer menu, orderable in POS.
  posOnly: boolean;
  // Availability window (customer menu): days 0=Sun..6=Sat (empty = every day),
  // venue-local "HH:MM" from/to (null = all day; may wrap past midnight).
  availableDays: number[];
  availableFrom: string | null;
  availableTo: string | null;
  sortOrder: number;
  isFeatured: boolean;
  featuredOrder: number;
  // Configurable option groups + choices (same shape as the public menu).
  optionGroups?: OptionGroup[];
  createdAt: string;
  updatedAt: string;
}

export interface MenuSettings {
  featuredTitle: string;
  // Master switch for the customer-menu featured strip.
  featuredEnabled: boolean;
  takeawayCharge: number;
  // Customer-menu hero banner. An empty image list = default gradient; multiple
  // images rotate as a slideshow. Null title/subtitle = default copy.
  bannerImageUrls: string[];
  bannerTitle: string | null;
  bannerSubtitle: string | null;
}

// GET /admin/settings — store-level settings module.
export interface Settings {
  storeName: string;
  logoUrl: string | null;
  featuredTitle: string;
  takeawayCharge: number;
  // Service charge as a percentage; 0 = not applied. Plus a list of named taxes.
  serviceChargeRate: number;
  taxes: { name: string; rate: number }[];
  pinConfigured: boolean;
  voidPinRequired: boolean;
  discountPinRequired: boolean;
  overridePinRequired: boolean;
  paymentMethods: string[];
}

// GET /admin/vouchers — a discount voucher / promo code.
export interface Voucher {
  id: string;
  code: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  minSpend: number;
  maxRedemptions: number | null;
  redeemedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VoucherInput {
  code: string;
  description?: string | null;
  discountType: DiscountType;
  discountValue: number;
  minSpend?: number;
  maxRedemptions?: number | null;
  expiresAt?: string | null;
  isActive?: boolean;
}

export interface MenuItemInput {
  categoryId: string;
  name: string;
  description?: string;
  imageUrls: string[];
  tags?: string[];
  price: number;
  discountType?: DiscountType | null;
  discountValue?: number;
  isAvailable: boolean;
  posOnly?: boolean;
  availableDays?: number[];
  availableFrom?: string | null;
  availableTo?: string | null;
  sortOrder?: number;
  // Configurable option groups (full-replace on save). Omit to leave untouched.
  optionGroups?: OptionGroupInput[];
}

// One configurable option group as sent to the API (no ids — server recreates).
export interface OptionGroupInput {
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  choices: { name: string; priceDelta: number }[];
}

// --- Tables (GET /admin/tables element) ---
export interface Table {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  orderCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TableInput {
  name: string;
  isActive: boolean;
}

// --- Public menu (GET /public/menu?tableCode=...) ---
export interface OptionChoice {
  id: string;
  name: string;
  priceDelta: number;
}

export interface OptionGroup {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  choices: OptionChoice[];
}

export interface PublicMenuItem {
  id: string;
  name: string;
  description: string | null;
  imageUrls: string[];
  tag: string | null;
  tags: string[];
  price: number;
  salePrice: number | null;
  isAvailable: boolean;
  // POS-only ("secret") item — only present in the staff POS menu, never the
  // customer menu (the public API always sends false).
  posOnly: boolean;
  sortOrder: number;
  categoryId: string;
  optionGroups: OptionGroup[];
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  sortOrder: number;
  items: PublicMenuItem[];
}

export interface PublicMenu {
  store: { id: string; name: string; slug: string };
  table: { id: string; name: string; code: string; isActive: boolean };
  takeawayCharge: number;
  categories: PublicMenuCategory[];
}

// --- Placing an order (POST /orders) ---
export type DiscountType = "PERCENT" | "FIXED";

export interface PlaceOrderItem {
  // A menu item, OR a custom (open) line — admin only — with name + price.
  menuItemId?: string;
  customName?: string;
  customPrice?: number;
  quantity: number;
  note?: string;
  optionChoiceIds?: string[];
  // Ad-hoc custom add-ons / special requests (name + price) attached to this line.
  addons?: { name: string; price: number }[];
  // Admin order-entry only (POST /admin/orders): manual price override + takeaway.
  priceOverride?: number;
  isTakeaway?: boolean;
  applyTakeawayCharge?: boolean;
  // Manual line discount (PIN-gated): percent or fixed RM off the line.
  discountType?: DiscountType;
  discountValue?: number;
}

export interface PlaceOrderInput {
  tableCode: string;
  note?: string;
  items: PlaceOrderItem[];
}

export interface PlaceOrderResponse {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  tableName: string;
  sessionId: string;
  sessionNumber: number;
  roundNumber: number | null;
  subtotal: number;
  total: number;
  totalItems: number;
  createdAt: string;
}

// --- Sessions / running tabs ---
export type SessionStatus = "OPEN" | "CLOSED" | "CANCELLED" | "MERGED";

export interface SelectedOption {
  group: string;
  choice: string;
  priceDelta: number;
}

// GET /admin/floor element
export interface FloorTable {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface FloorSession {
  id: string;
  sessionNumber: number;
  status: SessionStatus;
  pax: number | null;
  openedAt: string;
  total: number;
  // Part-paid (split/partial settlement): tendered so far + what's still owed.
  amountPaid: number;
  balanceDue: number;
  totalItems: number;
  roundCount: number;
  anyPrintFailed: boolean;
}

export interface FloorEntry {
  table: FloorTable;
  session: FloorSession | null;
}

// A round (one Order) inside a session — GET /admin/sessions/:id .rounds[]
export interface SessionRoundItem {
  id: string;
  // Null for a custom (open) line added by staff.
  menuItemId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  note: string | null;
  selectedOptions: SelectedOption[];
  isTakeaway: boolean;
  takeawayCharge: number;
  priceOverridden: boolean;
  discountType: DiscountType | null;
  discountValue: number;
  discountAmount: number;
  voided: boolean;
  voidReason: string | null;
}

export interface SessionRound {
  id: string;
  orderNumber: number;
  roundNumber: number | null;
  status: OrderStatus;
  createdAt: string;
  totalItems: number;
  total: number;
  printStatus: PrintStatus;
  items: SessionRoundItem[];
}

// GET /admin/sessions/:id
export interface SessionDetail {
  id: string;
  sessionNumber: number;
  status: SessionStatus;
  pax: number | null;
  paymentMethod: string | null;
  openedAt: string;
  closedAt: string | null;
  table: FloorTable;
  total: number;
  // Bill-level discount (0 until settled with one) + the resulting net.
  discountType: DiscountType | null;
  discountValue: number;
  discount: number;
  // Voucher applied to the tab (attached by a customer or at settlement).
  voucherCode: string | null;
  voucherDiscount: number;
  netTotal: number;
  // Tender ledger: each payment toward the tab + the running paid / tip totals
  // and what's still owed (> 0 while a tab is part-paid).
  payments: Payment[];
  amountPaid: number;
  tipTotal: number;
  balanceDue: number;
  totalItems: number;
  roundCount: number;
  rounds: SessionRound[];
}

// One tender against a tab (single payment, or one of several when split).
export interface Payment {
  id: string;
  method: string;
  amount: number;
  tip: number;
  tendered: number | null;
  reference: string | null;
  voided: boolean;
  createdAt: string;
}

// GET /admin/sessions?status= element (history)
export interface SessionSummary {
  id: string;
  sessionNumber: number;
  status: SessionStatus;
  tableName: string;
  openedAt: string;
  closedAt: string | null;
  total: number;
  totalItems: number;
  roundCount: number;
}

// GET /admin/reports/daily — end-of-day (Z reading) sales report.
// GET /admin/reports/sales?from&to — sales report for a business-day range
// (one day = a Z reading; a month or range aggregates the same breakdowns).
export interface ReportCategoryRow {
  category: string;
  quantity: number;
  revenue: number;
  pct: number;
}

export interface ReportItemRow {
  name: string;
  quantity: number;
  revenue: number;
}

export interface ReportPaymentRow {
  method: string;
  tabs: number;
  amount: number;
  pct: number;
}

export interface ReportDaypartRow {
  key: string;
  label: string;
  tabs: number;
  covers: number;
  revenue: number;
  pct: number;
}

export interface ReportHourRow {
  hour: number;
  revenue: number;
  tabs: number;
}

export interface ReportSeriesRow {
  date: string;
  netSales: number;
  grossSales: number;
  tabs: number;
  covers: number;
}

export interface ReportTabRow {
  sessionNumber: number;
  tableName: string;
  pax: number | null;
  paymentMethod: string | null;
  openedAt: string;
  closedAt: string | null;
  orders: number;
  items: number;
  discount: number;
  total: number;
}

export interface SalesReport {
  period: { from: string; to: string; days: number; kind: "day" | "month" | "range" };
  storeName: string;
  generatedAt: string;
  charges: { serviceChargeRate: number; taxes: { name: string; rate: number }[] };
  sales: {
    grossSales: number;
    itemDiscounts: number;
    billDiscounts: number;
    voucherDiscounts: number;
    totalDiscounts: number;
    netSales: number;
    // Tax-inclusive decomposition of the collected net.
    subtotalExCharges: number;
    serviceCharge: number;
    taxes: { name: string; rate: number; amount: number }[];
    totalTax: number;
    totalCollected: number;
    takeawayCharges: number;
    // Gratuity collected on top of net sales (not revenue).
    tips: number;
    grandTotalCollected: number;
  };
  counts: {
    tabsSettled: number;
    orders: number;
    itemsSold: number;
    covers: number;
    tablesUsed: number;
    discountedItems: number;
    discountedTabs: number;
  };
  averages: {
    perTab: number;
    perOrder: number;
    perCover: number;
    itemsPerTab: number;
    tableTurns: number;
    diningMinutes: number;
    salesPerDay: number;
  };
  byCategory: ReportCategoryRow[];
  items: ReportItemRow[];
  byPayment: ReportPaymentRow[];
  channels: {
    dineIn: { items: number; revenue: number };
    takeaway: { items: number; revenue: number; charges: number };
  };
  dayparts: ReportDaypartRow[];
  hourly: ReportHourRow[];
  series: ReportSeriesRow[];
  discounts: {
    items: number;
    bill: number;
    total: number;
    pctOfGross: number;
    discountedItems: number;
    discountedTabs: number;
  };
  vouchers: {
    count: number;
    amount: number;
    byCode: { code: string; count: number; amount: number }[];
  };
  voids: {
    items: { count: number; amount: number };
    tabs: { count: number; rounds: number; amount: number };
    byReason: { reason: string; count: number; amount: number }[];
  };
  audit: {
    firstBillNumber: number | null;
    lastBillNumber: number | null;
    billCount: number;
    firstCloseAt: string | null;
    lastCloseAt: string | null;
  };
  tabs: ReportTabRow[];
}

// GET /admin/orders/table/:tableId — a table's flat order history.
export interface TableOrder {
  id: string;
  orderNumber: number;
  roundNumber: number | null;
  sessionId: string | null;
  tableCode: string;
  status: OrderStatus;
  createdAt: string;
  total: number;
  totalItems: number;
  printStatus: PrintStatus;
  items: SessionRoundItem[];
}

// GET /admin/billing — subscription / trial status for this tenant.
export interface Billing {
  plan: string | null;
  status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
  active: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  currentPeriodEnd: string | null;
  billingEnabled: boolean;
  plans: {
    key: string;
    name: string;
    description: string | null;
    monthlyPrice: number;
    currency: string;
    features: string[];
    maxTables: number | null;
    maxMenuItems: number | null;
  }[];
}

// GET /admin/entitlements — the tenant's effective plan features + limits + live usage.
export interface Entitlements {
  tier: "basic" | "pro";
  isTrial: boolean;
  features: string[];
  limits: { maxTables: number | null; maxMenuItems: number | null };
  usage: { tables: number; menuItems: number };
}

// GET /admin/orders/print-health — kitchen-printing health for this tenant.
export interface PrintHealth {
  healthy: boolean;
  counts: { failedTerminal: number; retrying: number; pending: number; stuck: number };
  recentFailures: {
    id: string;
    orderNumber: number;
    error: string | null;
    retryCount: number;
    at: string;
  }[];
}
