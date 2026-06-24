/// <reference types="zod-openapi" />
/**
 * Typed response `data` schemas for the OpenAPI document (src/lib/openapi.ts).
 *
 * Every endpoint's success envelope is `{ success: true, data }`; this file types
 * the `data`, reverse-engineered from the service DTOs. Reusable DTOs carry a
 * `.meta({ id })` so `zod-openapi` hoists them into `components/schemas` and the
 * spec $refs them. `openapi.ts` injects these into each operation's 2xx response
 * via the `responseData` map (keyed by `"METHOD /path"`).
 *
 * These MIRROR the hand-written service DTOs — they are documentation only (not
 * enforced at runtime), so keep them in sync when a DTO's shape changes. Money is
 * a number; timestamps are ISO 8601 strings.
 */
import { z } from 'zod';

const dt = () => z.string().meta({ format: 'date-time' });

// ---- Shared -----------------------------------------------------------------

const DeactivateResponseDto = z
  .object({ id: z.string(), deactivated: z.boolean() })
  .meta({
    id: 'DeactivateResponseDto',
    description: 'A record was deactivated (never hard-deleted).',
  });

// Minimal table reference embedded in menus, sessions and the public table lookup.
const TableDto = z
  .object({ id: z.string(), name: z.string(), code: z.string(), isActive: z.boolean() })
  .meta({ id: 'TableDto' });

const SelectedOptionDto = z
  .object({ group: z.string(), choice: z.string(), priceDelta: z.number() })
  .meta({ id: 'SelectedOptionDto' });

const StoreDto = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    logoUrl: z.string().nullable(),
    themeColor: z.string().nullable(),
  })
  .meta({ id: 'StoreDto' });

// ---- Admin menu (categories / items / combos / settings) --------------------

const MenuCategoryDto = z
  .object({
    id: z.string(),
    name: z.string(),
    sortOrder: z.number().int(),
    isActive: z.boolean(),
    itemCount: z.number().int(),
    createdAt: dt(),
    updatedAt: dt(),
  })
  .meta({ id: 'MenuCategoryDto' });

const MenuOptionChoiceDto = z
  .object({ id: z.string(), name: z.string(), priceDelta: z.number() })
  .meta({ id: 'MenuOptionChoiceDto' });

const MenuOptionGroupDto = z
  .object({
    id: z.string(),
    name: z.string(),
    required: z.boolean(),
    minSelect: z.number().int(),
    maxSelect: z.number().int(),
    choices: z.array(MenuOptionChoiceDto),
  })
  .meta({ id: 'MenuOptionGroupDto' });

const MenuItemDto = z
  .object({
    id: z.string(),
    categoryId: z.string(),
    categoryName: z.string().nullable(),
    name: z.string(),
    description: z.string().nullable(),
    imageUrls: z.array(z.string()),
    tags: z.array(z.string()),
    price: z.number(),
    discountType: z.string().nullable(),
    discountValue: z.number(),
    salePrice: z.number(),
    isAvailable: z.boolean(),
    isActive: z.boolean(),
    posOnly: z.boolean(),
    availableDays: z.array(z.number().int()),
    availableFrom: z.string().nullable(),
    availableTo: z.string().nullable(),
    sortOrder: z.number().int(),
    isFeatured: z.boolean(),
    featuredOrder: z.number().int(),
    trackStock: z.boolean(),
    stockQty: z.number().int(),
    lowStockThreshold: z.number().int().nullable(),
    optionGroups: z.array(MenuOptionGroupDto),
    createdAt: dt(),
    updatedAt: dt(),
  })
  .meta({ id: 'MenuItemDto' });

// Combos share one `toComboDto` shape on both the admin and customer menus.
const ComboOptionDto = z
  .object({
    id: z.string(),
    menuItemId: z.string(),
    name: z.string(),
    priceDelta: z.number(),
    isAvailable: z.boolean(),
  })
  .meta({ id: 'ComboOptionDto' });

const ComboGroupDto = z
  .object({ id: z.string(), name: z.string(), options: z.array(ComboOptionDto) })
  .meta({ id: 'ComboGroupDto' });

const MenuComboDto = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    imageUrls: z.array(z.string()),
    price: z.number(),
    isAvailable: z.boolean(),
    isActive: z.boolean(),
    posOnly: z.boolean(),
    sortOrder: z.number().int(),
    groups: z.array(ComboGroupDto),
  })
  .meta({ id: 'MenuComboDto' });

const MenuSettingsDto = z
  .object({
    featuredTitle: z.string(),
    featuredEnabled: z.boolean(),
    takeawayCharge: z.number(),
    bannerImageUrls: z.array(z.string()),
    bannerTitle: z.string().nullable(),
    bannerSubtitle: z.string().nullable(),
  })
  .meta({ id: 'MenuSettingsDto' });

// ---- Public (customer) menu -------------------------------------------------

const PublicMenuOptionChoiceDto = z
  .object({ id: z.string(), name: z.string(), priceDelta: z.number() })
  .meta({ id: 'PublicMenuOptionChoiceDto' });

const PublicMenuOptionGroupDto = z
  .object({
    id: z.string(),
    name: z.string(),
    required: z.boolean(),
    minSelect: z.number().int(),
    maxSelect: z.number().int(),
    choices: z.array(PublicMenuOptionChoiceDto),
  })
  .meta({ id: 'PublicMenuOptionGroupDto' });

const PublicMenuItemDto = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    imageUrls: z.array(z.string()),
    tag: z.string().nullable(),
    tags: z.array(z.string()),
    price: z.number(),
    salePrice: z.number(),
    isAvailable: z.boolean(),
    availableNow: z.boolean(),
    posOnly: z.boolean(),
    sortOrder: z.number().int(),
    categoryId: z.string(),
    optionGroups: z.array(PublicMenuOptionGroupDto),
  })
  .meta({ id: 'PublicMenuItemDto' });

const PublicMenuCategoryDto = z
  .object({
    id: z.string(),
    name: z.string(),
    sortOrder: z.number().int(),
    items: z.array(PublicMenuItemDto),
  })
  .meta({ id: 'PublicMenuCategoryDto' });

const BannerDto = z
  .object({
    imageUrls: z.array(z.string()),
    title: z.string().nullable(),
    subtitle: z.string().nullable(),
  })
  .meta({ id: 'BannerDto' });

const TableMenuDto = z
  .object({
    store: StoreDto,
    table: TableDto,
    featuredTitle: z.string(),
    takeawayCharge: z.number(),
    combos: z.array(MenuComboDto),
    banner: BannerDto,
    featured: z.array(PublicMenuItemDto),
    categories: z.array(PublicMenuCategoryDto),
  })
  .meta({ id: 'TableMenuDto' });

const GetTableDto = z.object({ table: TableDto, store: StoreDto }).meta({ id: 'GetTableDto' });

const VoucherResultDto = z
  .object({
    code: z.string(),
    discountType: z.enum(['PERCENT', 'FIXED']),
    discountValue: z.number(),
    estimatedDiscount: z.number(),
  })
  .meta({ id: 'VoucherResultDto' });

// ---- Orders -----------------------------------------------------------------

const CreateOrderResultDto = z
  .object({
    id: z.string(),
    orderNumber: z.number().int(),
    status: z.string(),
    tableName: z.string(),
    sessionId: z.string(),
    sessionNumber: z.number().int(),
    roundNumber: z.number().int(),
    subtotal: z.number(),
    total: z.number(),
    totalItems: z.number().int(),
    createdAt: dt(),
  })
  .meta({ id: 'CreateOrderResultDto' });

const ListOrderDto = z
  .object({
    id: z.string(),
    orderNumber: z.number().int(),
    status: z.enum(['NEW', 'COMPLETED', 'CANCELLED']),
    tableName: z.string(),
    totalItems: z.number().int(),
    total: z.number(),
    printStatus: z.enum(['PENDING', 'PRINTING', 'PRINTED', 'FAILED']).nullable(),
    createdAt: dt(),
  })
  .meta({ id: 'ListOrderDto' });

const OrderPrintJobDto = z
  .object({
    id: z.string(),
    status: z.enum(['PENDING', 'PRINTING', 'PRINTED', 'FAILED']),
    error: z.string().nullable(),
    retryCount: z.number().int(),
    createdAt: dt(),
    printedAt: dt().nullable(),
  })
  .meta({ id: 'OrderPrintJobDto' });

const OrderItemDto = z
  .object({
    id: z.string(),
    menuItemId: z.string().nullable(),
    name: z.string(),
    quantity: z.number().int(),
    unitPrice: z.number(),
    totalPrice: z.number(),
    note: z.string().nullable(),
    selectedOptions: z.array(SelectedOptionDto),
  })
  .meta({ id: 'OrderItemDto' });

const OrderDetailDto = z
  .object({
    id: z.string(),
    orderNumber: z.number().int(),
    status: z.enum(['NEW', 'COMPLETED', 'CANCELLED']),
    note: z.string().nullable(),
    tableId: z.string(),
    tableName: z.string(),
    tableCode: z.string(),
    subtotal: z.number(),
    total: z.number(),
    totalItems: z.number().int(),
    createdAt: dt(),
    updatedAt: dt(),
    items: z.array(OrderItemDto),
    printJobs: z.array(OrderPrintJobDto),
  })
  .meta({ id: 'OrderDetailDto' });

const TableOrderHistoryItemDto = z
  .object({
    id: z.string(),
    menuItemId: z.string().nullable(),
    name: z.string(),
    quantity: z.number().int(),
    unitPrice: z.number(),
    totalPrice: z.number(),
    note: z.string().nullable(),
    selectedOptions: z.array(SelectedOptionDto),
    isTakeaway: z.boolean(),
    takeawayCharge: z.number(),
    priceOverridden: z.boolean(),
    voided: z.boolean(),
    voidReason: z.string().nullable(),
  })
  .meta({ id: 'TableOrderHistoryItemDto' });

const TableOrderDto = z
  .object({
    id: z.string(),
    orderNumber: z.number().int(),
    roundNumber: z.number().int(),
    sessionId: z.string(),
    tableCode: z.string(),
    status: z.enum(['NEW', 'COMPLETED', 'CANCELLED']),
    createdAt: dt(),
    total: z.number(),
    totalItems: z.number().int(),
    printStatus: z.enum(['PENDING', 'PRINTING', 'PRINTED', 'FAILED']).nullable(),
    items: z.array(TableOrderHistoryItemDto),
  })
  .meta({ id: 'TableOrderDto' });

const ReprintResultDto = z
  .object({ printJobId: z.string(), status: z.enum(['PENDING', 'PRINTING', 'PRINTED', 'FAILED']) })
  .meta({ id: 'ReprintResultDto' });

const RecentPrintFailureDto = z
  .object({
    id: z.string(),
    orderNumber: z.number().int(),
    error: z.string().nullable(),
    retryCount: z.number().int(),
    at: dt(),
  })
  .meta({ id: 'RecentPrintFailureDto' });

const PrintHealthDto = z
  .object({
    healthy: z.boolean(),
    counts: z.object({
      failedTerminal: z.number().int(),
      retrying: z.number().int(),
      pending: z.number().int(),
      stuck: z.number().int(),
    }),
    recentFailures: z.array(RecentPrintFailureDto),
  })
  .meta({ id: 'PrintHealthDto' });

// ---- Floor & sessions -------------------------------------------------------

const SessionSummaryDto = z
  .object({
    id: z.string(),
    sessionNumber: z.number().int(),
    status: z.enum(['OPEN', 'CLOSED', 'CANCELLED', 'MERGED']),
    pax: z.number().int(),
    openedAt: dt(),
    total: z.number(),
    amountPaid: z.number(),
    balanceDue: z.number(),
    totalItems: z.number().int(),
    roundCount: z.number().int(),
    anyPrintFailed: z.boolean(),
  })
  .meta({ id: 'SessionSummaryDto' });

const FloorEntryDto = z
  .object({ table: TableDto, session: SessionSummaryDto.nullable() })
  .meta({ id: 'FloorEntryDto' });

const SessionListItemDto = z
  .object({
    id: z.string(),
    sessionNumber: z.number().int(),
    status: z.enum(['OPEN', 'CLOSED', 'CANCELLED', 'MERGED']),
    tableName: z.string(),
    openedAt: dt(),
    closedAt: dt().nullable(),
    total: z.number(),
    totalItems: z.number().int(),
    roundCount: z.number().int(),
  })
  .meta({ id: 'SessionListItemDto' });

const SessionRoundItemDto = z
  .object({
    id: z.string(),
    menuItemId: z.string().nullable(),
    name: z.string(),
    quantity: z.number().int(),
    unitPrice: z.number(),
    totalPrice: z.number(),
    note: z.string().nullable(),
    selectedOptions: z.array(SelectedOptionDto),
    isTakeaway: z.boolean(),
    takeawayCharge: z.number(),
    priceOverridden: z.boolean(),
    discountType: z.string().nullable(),
    discountValue: z.number(),
    discountAmount: z.number(),
    voided: z.boolean(),
    voidReason: z.string().nullable(),
  })
  .meta({ id: 'SessionRoundItemDto' });

const RoundDto = z
  .object({
    id: z.string(),
    orderNumber: z.number().int(),
    roundNumber: z.number().int(),
    status: z.enum(['NEW', 'COMPLETED', 'CANCELLED']),
    createdAt: dt(),
    totalItems: z.number().int(),
    total: z.number(),
    printStatus: z.enum(['PENDING', 'PRINTING', 'PRINTED', 'FAILED']).nullable(),
    items: z.array(SessionRoundItemDto),
  })
  .meta({ id: 'RoundDto' });

const SessionMemberDto = z
  .object({
    id: z.string(),
    phone: z.string(),
    name: z.string(),
    pointsBalance: z.number().int(),
    tier: z.string(),
  })
  .meta({ id: 'SessionMemberDto' });

const PaymentDto = z
  .object({
    id: z.string(),
    method: z.string(),
    amount: z.number(),
    tip: z.number(),
    tendered: z.number().nullable(),
    reference: z.string().nullable(),
    voided: z.boolean(),
    createdAt: dt(),
  })
  .meta({ id: 'PaymentDto' });

const SessionDetailDto = z
  .object({
    id: z.string(),
    sessionNumber: z.number().int(),
    status: z.enum(['OPEN', 'CLOSED', 'CANCELLED', 'MERGED']),
    pax: z.number().int(),
    paymentMethod: z.string().nullable(),
    openedAt: dt(),
    closedAt: dt().nullable(),
    table: TableDto,
    total: z.number(),
    discountType: z.string().nullable(),
    discountValue: z.number(),
    discount: z.number(),
    voucherCode: z.string().nullable(),
    voucherDiscount: z.number(),
    member: SessionMemberDto.nullable(),
    loyaltyDiscount: z.number(),
    pointsRedeemed: z.number().int(),
    pointsEarned: z.number().int(),
    netTotal: z.number(),
    payments: z.array(PaymentDto),
    amountPaid: z.number(),
    tipTotal: z.number(),
    balanceDue: z.number(),
    totalItems: z.number().int(),
    roundCount: z.number().int(),
    rounds: z.array(RoundDto),
  })
  .meta({ id: 'SessionDetailDto' });

// ---- Loyalty ----------------------------------------------------------------

const TierDefDto = z
  .object({ tier: z.string(), threshold: z.number().int(), earnMultiplier: z.number() })
  .meta({ id: 'TierDefDto' });

const LoyaltyConfigDto = z
  .object({
    loyaltyEnabled: z.boolean(),
    pointsEnabled: z.boolean(),
    stampsEnabled: z.boolean(),
    earnRatePoints: z.number(),
    redeemRatePoints: z.number().int(),
    minRedeemPoints: z.number().int(),
    maxRedeemPercent: z.number(),
    pointsExpiryMonths: z.number().int().nullable(),
    welcomeBonusPoints: z.number().int(),
    birthdayBonusPoints: z.number().int(),
    stampThreshold: z.number().int(),
    stampMinSpend: z.number(),
    stampRewardType: z.string().nullable(),
    stampRewardValue: z.number(),
    stampRewardItemId: z.string().nullable(),
    tierThresholds: z.array(TierDefDto),
    tierBasis: z.string(),
  })
  .meta({ id: 'LoyaltyConfigDto' });

const MemberDto = z
  .object({
    id: z.string(),
    phone: z.string(),
    name: z.string().nullable(),
    birthday: z.string().nullable(),
    pointsBalance: z.number().int(),
    lifetimePoints: z.number().int(),
    lifetimeSpend: z.number(),
    tier: z.string(),
    stampCount: z.number().int(),
    consentMarketing: z.boolean(),
    joinedAt: dt(),
    lastActivityAt: dt(),
    isActive: z.boolean(),
    createdAt: dt(),
    updatedAt: dt(),
  })
  .meta({ id: 'MemberDto' });

const PointsLedgerEntryDto = z
  .object({
    id: z.string(),
    type: z.string(),
    points: z.number().int(),
    reason: z.string().nullable(),
    sessionId: z.string().nullable(),
    createdAt: dt(),
  })
  .meta({ id: 'PointsLedgerEntryDto' });

const StampLedgerEntryDto = z
  .object({
    id: z.string(),
    delta: z.number().int(),
    reason: z.string().nullable(),
    createdAt: dt(),
  })
  .meta({ id: 'StampLedgerEntryDto' });

const RewardRedemptionDto = z
  .object({
    id: z.string(),
    type: z.string(),
    name: z.string(),
    value: z.number(),
    menuItemId: z.string().nullable(),
    pointsSpent: z.number().int(),
    source: z.string(),
    status: z.string(),
    expiresAt: dt().nullable(),
    sessionId: z.string().nullable(),
    usedAt: dt().nullable(),
    createdAt: dt(),
  })
  .meta({ id: 'RewardRedemptionDto' });

const MemberDetailDto = z
  .object({
    id: z.string(),
    phone: z.string(),
    name: z.string().nullable(),
    birthday: z.string().nullable(),
    pointsBalance: z.number().int(),
    lifetimePoints: z.number().int(),
    lifetimeSpend: z.number(),
    tier: z.string(),
    stampCount: z.number().int(),
    consentMarketing: z.boolean(),
    joinedAt: dt(),
    lastActivityAt: dt(),
    isActive: z.boolean(),
    createdAt: dt(),
    updatedAt: dt(),
    pointsLedger: z.array(PointsLedgerEntryDto),
    stampLedger: z.array(StampLedgerEntryDto),
    rewards: z.array(RewardRedemptionDto),
  })
  .meta({ id: 'MemberDetailDto' });

const RewardDto = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    pointsCost: z.number().int(),
    type: z.string(),
    value: z.number(),
    menuItemId: z.string().nullable(),
    isActive: z.boolean(),
    createdAt: dt(),
    updatedAt: dt(),
  })
  .meta({ id: 'RewardDto' });

// ---- Platform (super-admin) -------------------------------------------------

const PlanDto = z
  .object({
    key: z.enum(['basic', 'pro']),
    name: z.string(),
    description: z.string().nullable(),
    monthlyPrice: z.number(),
    currency: z.string(),
    stripePriceId: z.string().nullable(),
    features: z.array(z.string()),
    maxTables: z.number().int().nullable(),
    maxMenuItems: z.number().int().nullable(),
    sortOrder: z.number().int(),
    isActive: z.boolean(),
  })
  .meta({ id: 'PlanDto' });

const AuditLogEntryDto = z
  .object({
    id: z.string(),
    actorId: z.string().nullable(),
    actorEmail: z.string(),
    actorImp: z.string().nullable(),
    action: z.string(),
    entity: z.string(),
    entityId: z.string().nullable(),
    storeId: z.string().nullable(),
    summary: z.string().nullable(),
    metadata: z.unknown().nullable(),
    requestId: z.string().nullable(),
    ip: z.string().nullable(),
    createdAt: dt(),
  })
  .meta({ id: 'AuditLogEntryDto' });

const AuditLogPageDto = z
  .object({
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
    entries: z.array(AuditLogEntryDto),
  })
  .meta({ id: 'AuditLogPageDto' });

const OutletDto = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    plan: z.string().nullable(),
    subscriptionStatus: z.string(),
    trialEndsAt: dt().nullable(),
    isActive: z.boolean(),
    tableCount: z.number().int(),
    menuItemCount: z.number().int(),
    createdAt: dt(),
  })
  .meta({ id: 'OutletDto' });

const ClientDto = z
  .object({
    id: z.string(),
    name: z.string(),
    contactEmail: z.string().nullable(),
    contactPhone: z.string().nullable(),
    notes: z.string().nullable(),
    isActive: z.boolean(),
    createdAt: dt(),
    updatedAt: dt(),
    outletCount: z.number().int(),
    outlets: z.array(OutletDto),
  })
  .meta({ id: 'ClientDto' });

const ImpersonationResultDto = z
  .object({
    token: z.string(),
    outlet: z.object({ id: z.string(), name: z.string() }).meta({ id: 'ImpersonationOutletDto' }),
  })
  .meta({ id: 'ImpersonationResultDto' });

const SiblingOutletDto = z
  .object({ id: z.string(), name: z.string(), current: z.boolean() })
  .meta({ id: 'SiblingOutletDto' });

const MyOutletsDto = z
  .object({
    clientName: z.string().nullable(),
    currentStoreId: z.string(),
    outlets: z.array(SiblingOutletDto),
  })
  .meta({ id: 'MyOutletsDto' });

const SwitchOutletResultDto = z
  .object({
    token: z.string(),
    outlet: z.object({ id: z.string(), name: z.string() }).meta({ id: 'SwitchOutletDto' }),
  })
  .meta({ id: 'SwitchOutletResultDto' });

// ---- Auth / billing / settings / tables / vouchers / reports / uploads ------

const AdminUserDto = z
  .object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
    storeId: z.string(),
    role: z.string(),
    isPlatformAdmin: z.boolean(),
  })
  .meta({ id: 'AdminUserDto' });

const AuthLoginDto = z
  .object({ token: z.string(), user: AdminUserDto })
  .meta({ id: 'AuthLoginDto' });

const AuthProfileDto = z
  .object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
    role: z.string(),
    isPlatformAdmin: z.boolean(),
    imp: z.string().nullable(),
  })
  .meta({ id: 'AuthProfileDto' });

const VerifyPasswordDto = z.object({ ok: z.boolean() }).meta({ id: 'VerifyPasswordDto' });

const BillingPlanDto = z
  .object({
    key: z.string(),
    name: z.string(),
    description: z.string(),
    monthlyPrice: z.number(),
    currency: z.string(),
    features: z.array(z.string()),
    maxTables: z.number().nullable(),
    maxMenuItems: z.number().nullable(),
  })
  .meta({ id: 'BillingPlanDto' });

const BillingStateDto = z
  .object({
    plan: z.string().nullable(),
    status: z.enum(['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED']),
    active: z.boolean(),
    trialEndsAt: dt().nullable(),
    trialDaysLeft: z.number().int().nullable(),
    currentPeriodEnd: dt().nullable(),
    billingEnabled: z.boolean(),
    plans: z.array(BillingPlanDto),
  })
  .meta({ id: 'BillingStateDto' });

const BillingCheckoutDto = z
  .object({ url: z.string().nullable() })
  .meta({ id: 'BillingCheckoutDto' });
const BillingPortalDto = z.object({ url: z.string().nullable() }).meta({ id: 'BillingPortalDto' });

const SettingsTaxDto = z
  .object({ name: z.string(), rate: z.number() })
  .meta({ id: 'SettingsTaxDto' });

const SettingsDto = z
  .object({
    storeName: z.string(),
    logoUrl: z.string().nullable(),
    themeColor: z.string().nullable(),
    featuredTitle: z.string(),
    takeawayCharge: z.number(),
    serviceChargeRate: z.number(),
    taxes: z.array(SettingsTaxDto),
    pinConfigured: z.boolean(),
    voidPinRequired: z.boolean(),
    discountPinRequired: z.boolean(),
    overridePinRequired: z.boolean(),
    paymentMethods: z.array(z.string()),
  })
  .meta({ id: 'SettingsDto' });

const SetPinDto = z.object({ ok: z.boolean() }).meta({ id: 'SetPinDto' });
const VerifyPinDto = z
  .object({ ok: z.boolean(), configured: z.boolean() })
  .meta({ id: 'VerifyPinDto' });

const AdminTableDto = z
  .object({
    id: z.string(),
    name: z.string(),
    code: z.string(),
    isActive: z.boolean(),
    orderCount: z.number().int(),
    createdAt: dt(),
    updatedAt: dt(),
  })
  .meta({ id: 'AdminTableDto' });

const VoucherDto = z
  .object({
    id: z.string(),
    code: z.string(),
    description: z.string().nullable(),
    discountType: z.string(),
    discountValue: z.number(),
    minSpend: z.number(),
    maxRedemptions: z.number().int().nullable(),
    redeemedCount: z.number().int(),
    expiresAt: dt().nullable(),
    isActive: z.boolean(),
    createdAt: dt(),
    updatedAt: dt(),
  })
  .meta({ id: 'VoucherDto' });

// Sales (Z-reading) report — assembled from many sub-sections.
const SalesReportChargesDto = z
  .object({ serviceChargeRate: z.number(), taxes: z.array(SettingsTaxDto) })
  .meta({ id: 'SalesReportChargesDto' });

const SalesReportTaxDetailDto = z
  .object({ name: z.string(), rate: z.number(), amount: z.number() })
  .meta({ id: 'SalesReportTaxDetailDto' });

const SalesReportSalesDto = z
  .object({
    grossSales: z.number(),
    itemDiscounts: z.number(),
    billDiscounts: z.number(),
    voucherDiscounts: z.number(),
    totalDiscounts: z.number(),
    netSales: z.number(),
    subtotalExCharges: z.number(),
    serviceCharge: z.number(),
    taxes: z.array(SalesReportTaxDetailDto),
    totalTax: z.number(),
    totalCollected: z.number(),
    takeawayCharges: z.number(),
    tips: z.number(),
    grandTotalCollected: z.number(),
  })
  .meta({ id: 'SalesReportSalesDto' });

const SalesReportCountsDto = z
  .object({
    tabsSettled: z.number().int(),
    orders: z.number().int(),
    itemsSold: z.number().int(),
    covers: z.number().int(),
    tablesUsed: z.number().int(),
    discountedItems: z.number().int(),
    discountedTabs: z.number().int(),
  })
  .meta({ id: 'SalesReportCountsDto' });

const SalesReportAveragesDto = z
  .object({
    perTab: z.number(),
    perOrder: z.number(),
    perCover: z.number(),
    itemsPerTab: z.number(),
    tableTurns: z.number(),
    diningMinutes: z.number().int(),
    salesPerDay: z.number(),
  })
  .meta({ id: 'SalesReportAveragesDto' });

const SalesReportCategoryDto = z
  .object({
    category: z.string(),
    quantity: z.number().int(),
    revenue: z.number(),
    pct: z.number(),
  })
  .meta({ id: 'SalesReportCategoryDto' });

const SalesReportItemDto = z
  .object({ name: z.string(), quantity: z.number().int(), revenue: z.number() })
  .meta({ id: 'SalesReportItemDto' });

const SalesReportPaymentDto = z
  .object({ method: z.string(), tabs: z.number().int(), amount: z.number(), pct: z.number() })
  .meta({ id: 'SalesReportPaymentDto' });

const SalesReportChannelsDto = z
  .object({
    dineIn: z.object({ items: z.number().int(), revenue: z.number() }),
    takeaway: z.object({ items: z.number().int(), revenue: z.number(), charges: z.number() }),
  })
  .meta({ id: 'SalesReportChannelsDto' });

const SalesReportDaypartDto = z
  .object({
    key: z.string(),
    label: z.string(),
    tabs: z.number().int(),
    covers: z.number().int(),
    revenue: z.number(),
    pct: z.number(),
  })
  .meta({ id: 'SalesReportDaypartDto' });

const SalesReportHourlyDto = z
  .object({ hour: z.number().int(), revenue: z.number(), tabs: z.number().int() })
  .meta({ id: 'SalesReportHourlyDto' });

const SalesReportSeriesDto = z
  .object({
    date: z.string(),
    netSales: z.number(),
    grossSales: z.number(),
    tabs: z.number().int(),
    covers: z.number().int(),
  })
  .meta({ id: 'SalesReportSeriesDto' });

const SalesReportDiscountsDto = z
  .object({
    items: z.number(),
    bill: z.number(),
    total: z.number(),
    pctOfGross: z.number(),
    discountedItems: z.number().int(),
    discountedTabs: z.number().int(),
  })
  .meta({ id: 'SalesReportDiscountsDto' });

const SalesReportVoidReasonDto = z
  .object({ reason: z.string(), count: z.number().int(), amount: z.number() })
  .meta({ id: 'SalesReportVoidReasonDto' });

const SalesReportVoidsDto = z
  .object({
    items: z.object({ count: z.number().int(), amount: z.number() }),
    tabs: z.object({ count: z.number().int(), rounds: z.number().int(), amount: z.number() }),
    byReason: z.array(SalesReportVoidReasonDto),
  })
  .meta({ id: 'SalesReportVoidsDto' });

const SalesReportVoucherCodeDto = z
  .object({ code: z.string(), count: z.number().int(), amount: z.number() })
  .meta({ id: 'SalesReportVoucherCodeDto' });

const SalesReportVouchersDto = z
  .object({
    count: z.number().int(),
    amount: z.number(),
    byCode: z.array(SalesReportVoucherCodeDto),
  })
  .meta({ id: 'SalesReportVouchersDto' });

const SalesReportAuditDto = z
  .object({
    firstBillNumber: z.number().int().nullable(),
    lastBillNumber: z.number().int().nullable(),
    billCount: z.number().int(),
    firstCloseAt: dt().nullable(),
    lastCloseAt: dt().nullable(),
  })
  .meta({ id: 'SalesReportAuditDto' });

const SalesReportTabDto = z
  .object({
    sessionNumber: z.number().int(),
    tableName: z.string(),
    pax: z.number().int().nullable(),
    paymentMethod: z.string().nullable(),
    openedAt: dt().nullable(),
    closedAt: dt().nullable(),
    orders: z.number().int(),
    items: z.number().int(),
    discount: z.number(),
    total: z.number(),
  })
  .meta({ id: 'SalesReportTabDto' });

const SalesReportPeriodDto = z
  .object({
    from: z.string(),
    to: z.string(),
    days: z.number().int(),
    kind: z.enum(['day', 'month', 'range']),
  })
  .meta({ id: 'SalesReportPeriodDto' });

const SalesReportDto = z
  .object({
    period: SalesReportPeriodDto,
    storeName: z.string(),
    generatedAt: dt(),
    charges: SalesReportChargesDto,
    sales: SalesReportSalesDto,
    counts: SalesReportCountsDto,
    averages: SalesReportAveragesDto,
    byCategory: z.array(SalesReportCategoryDto),
    items: z.array(SalesReportItemDto),
    byPayment: z.array(SalesReportPaymentDto),
    channels: SalesReportChannelsDto,
    dayparts: z.array(SalesReportDaypartDto),
    hourly: z.array(SalesReportHourlyDto),
    series: z.array(SalesReportSeriesDto),
    discounts: SalesReportDiscountsDto,
    voids: SalesReportVoidsDto,
    vouchers: SalesReportVouchersDto,
    audit: SalesReportAuditDto,
    tabs: z.array(SalesReportTabDto),
  })
  .meta({ id: 'SalesReportDto' });

const UploadImageDto = z.object({ url: z.string() }).meta({ id: 'UploadImageDto' });

// ---- Print agent ------------------------------------------------------------

const PrintJobDto = z
  .object({
    id: z.string(),
    orderId: z.string(),
    status: z.string(),
    payload: z.unknown(),
    retryCount: z.number().int(),
    createdAt: dt(),
  })
  .meta({ id: 'PrintJobDto' });

const MarkPrintingDto = z
  .object({ id: z.string(), status: z.literal('PRINTING'), claimed: z.boolean() })
  .meta({ id: 'MarkPrintingDto' });

const MarkPrintedDto = z
  .object({ id: z.string(), status: z.string(), printedAt: dt().nullable() })
  .meta({ id: 'MarkPrintedDto' });

const MarkFailedDto = z
  .object({ id: z.string(), status: z.string(), retryCount: z.number().int() })
  .meta({ id: 'MarkFailedDto' });

// ---- Response map: "METHOD /path" -> data schema ----------------------------

export const responseData: Record<string, z.ZodTypeAny> = {
  // Public
  'GET /api/v1/public/tables/{tableCode}': GetTableDto,
  'GET /api/v1/public/menu': TableMenuDto,
  'POST /api/v1/public/voucher': VoucherResultDto,
  'POST /api/v1/orders': CreateOrderResultDto,

  // Admin orders
  'POST /api/v1/admin/orders': CreateOrderResultDto,
  'GET /api/v1/admin/orders': z.array(ListOrderDto),
  'GET /api/v1/admin/orders/print-health': PrintHealthDto,
  'GET /api/v1/admin/orders/table/{tableId}': z.array(TableOrderDto),
  'POST /api/v1/admin/orders/items/{id}/void': SessionDetailDto,
  'GET /api/v1/admin/orders/{id}': OrderDetailDto,
  'PATCH /api/v1/admin/orders/{id}/status': OrderDetailDto,
  'POST /api/v1/admin/orders/{id}/reprint': ReprintResultDto,

  // Floor & sessions
  'GET /api/v1/admin/floor': z.array(FloorEntryDto),
  'GET /api/v1/admin/sessions': z.array(SessionListItemDto),
  'GET /api/v1/admin/sessions/{id}': SessionDetailDto,
  'PATCH /api/v1/admin/sessions/{id}/pax': SessionDetailDto,
  'POST /api/v1/admin/sessions/{id}/close': SessionDetailDto,
  'POST /api/v1/admin/sessions/{id}/cancel': SessionDetailDto,
  'POST /api/v1/admin/sessions/{id}/move': SessionDetailDto,
  'POST /api/v1/admin/sessions/{id}/combine': SessionDetailDto,
  'POST /api/v1/admin/sessions/{id}/reopen': SessionDetailDto,

  // Auth
  'POST /api/v1/admin/auth/login': AuthLoginDto,
  'GET /api/v1/admin/auth/me': AuthProfileDto,
  'POST /api/v1/admin/auth/verify-password': VerifyPasswordDto,

  // Billing
  'GET /api/v1/admin/billing': BillingStateDto,
  'POST /api/v1/admin/billing/checkout': BillingCheckoutDto,
  'POST /api/v1/admin/billing/portal': BillingPortalDto,
  'POST /api/v1/admin/billing/apply': BillingStateDto,

  // Settings
  'GET /api/v1/admin/settings': SettingsDto,
  'PATCH /api/v1/admin/settings': SettingsDto,
  'POST /api/v1/admin/settings/pin': SetPinDto,
  'POST /api/v1/admin/settings/pin/verify': VerifyPinDto,

  // Tables
  'GET /api/v1/admin/tables': z.array(AdminTableDto),
  'POST /api/v1/admin/tables': AdminTableDto,
  'PATCH /api/v1/admin/tables/{id}': AdminTableDto,
  'DELETE /api/v1/admin/tables/{id}': DeactivateResponseDto,

  // Vouchers
  'GET /api/v1/admin/vouchers': z.array(VoucherDto),
  'POST /api/v1/admin/vouchers': VoucherDto,
  'PATCH /api/v1/admin/vouchers/{id}': VoucherDto,
  'DELETE /api/v1/admin/vouchers/{id}': DeactivateResponseDto,

  // Reports + uploads
  'GET /api/v1/admin/reports/sales': SalesReportDto,
  'POST /api/v1/admin/uploads/image': UploadImageDto,

  // Loyalty
  'GET /api/v1/admin/loyalty/config': LoyaltyConfigDto,
  'PATCH /api/v1/admin/loyalty/config': LoyaltyConfigDto,
  'GET /api/v1/admin/loyalty/members': z.array(MemberDto),
  'POST /api/v1/admin/loyalty/members': MemberDto,
  'GET /api/v1/admin/loyalty/members/{id}': MemberDetailDto,
  'PATCH /api/v1/admin/loyalty/members/{id}': MemberDto,
  'DELETE /api/v1/admin/loyalty/members/{id}': DeactivateResponseDto,
  'POST /api/v1/admin/loyalty/members/{id}/adjust': MemberDto,
  'GET /api/v1/admin/loyalty/rewards': z.array(RewardDto),
  'POST /api/v1/admin/loyalty/rewards': RewardDto,
  'PATCH /api/v1/admin/loyalty/rewards/{id}': RewardDto,
  'DELETE /api/v1/admin/loyalty/rewards/{id}': DeactivateResponseDto,

  // Platform + outlets
  'GET /api/v1/admin/platform/plans': z.array(PlanDto),
  'PATCH /api/v1/admin/platform/plans/{key}': z.array(PlanDto),
  'GET /api/v1/admin/platform/audit': AuditLogPageDto,
  'GET /api/v1/admin/platform/clients': z.array(ClientDto),
  'POST /api/v1/admin/platform/clients': ClientDto,
  'GET /api/v1/admin/platform/clients/{id}': ClientDto,
  'PATCH /api/v1/admin/platform/clients/{id}': ClientDto,
  'POST /api/v1/admin/platform/clients/{id}/outlets': ClientDto,
  'POST /api/v1/admin/platform/clients/{id}/apply-plan': ClientDto,
  'PATCH /api/v1/admin/platform/outlets/{storeId}': ClientDto,
  'POST /api/v1/admin/platform/outlets/{storeId}/impersonate': ImpersonationResultDto,
  'GET /api/v1/admin/outlets': MyOutletsDto,
  'POST /api/v1/admin/outlets/{storeId}/switch': SwitchOutletResultDto,

  // Menu — categories
  'GET /api/v1/admin/menu/categories': z.array(MenuCategoryDto),
  'POST /api/v1/admin/menu/categories': MenuCategoryDto,
  'PATCH /api/v1/admin/menu/categories/reorder': z.array(MenuCategoryDto),
  'PATCH /api/v1/admin/menu/categories/{id}': MenuCategoryDto,
  'DELETE /api/v1/admin/menu/categories/{id}': DeactivateResponseDto,

  // Menu — items
  'GET /api/v1/admin/menu/items': z.array(MenuItemDto),
  'POST /api/v1/admin/menu/items': MenuItemDto,
  'PATCH /api/v1/admin/menu/items/reorder': z.array(MenuItemDto),
  'PATCH /api/v1/admin/menu/items/featured/reorder': z.array(MenuItemDto),
  'PATCH /api/v1/admin/menu/items/{id}': MenuItemDto,
  'DELETE /api/v1/admin/menu/items/{id}': DeactivateResponseDto,
  'PATCH /api/v1/admin/menu/items/{id}/sold-out': MenuItemDto,
  'PATCH /api/v1/admin/menu/items/{id}/move': z.array(MenuItemDto),
  'PATCH /api/v1/admin/menu/items/{id}/feature': z.array(MenuItemDto),

  // Menu — combos + settings
  'GET /api/v1/admin/menu/combos': z.array(MenuComboDto),
  'POST /api/v1/admin/menu/combos': MenuComboDto,
  'PATCH /api/v1/admin/menu/combos/{id}': MenuComboDto,
  'DELETE /api/v1/admin/menu/combos/{id}': DeactivateResponseDto,
  'GET /api/v1/admin/menu/settings': MenuSettingsDto,
  'PATCH /api/v1/admin/menu/settings': MenuSettingsDto,

  // Print agent
  'GET /api/v1/print-agent/jobs/pending': z.array(PrintJobDto),
  'POST /api/v1/print-agent/jobs/{id}/mark-printing': MarkPrintingDto,
  'POST /api/v1/print-agent/jobs/{id}/mark-printed': MarkPrintedDto,
  'POST /api/v1/print-agent/jobs/{id}/mark-failed': MarkFailedDto,
};
