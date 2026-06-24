# Plan — Audit attribution + soft delete

**Status:** A1 + A2 done; **A3 core done** (delete→soft + read filter for 10 models). A3
remainder next: partial unique indexes (consent), `restore` endpoints + Trash view, and an
`AuditLog` row on delete. Scope refreshed against the current schema. Schema changes here
require explicit consent to run.

> **Soft-delete scope (implemented).** Behaviour applies to **10** independently-managed
> entities: `Store`, `Client`, `AdminUser`, `MenuCategory`, `MenuItem`, `Combo`, `Table`,
> `Voucher`, `Member`, `RewardCatalog`. **Hard delete kept** for the full-replace option/combo
> children (`OptionGroup`/`OptionChoice`/`ComboGroup`/`ComboOption` — rebuilt by
> delete-all-and-recreate, and an order snapshots its options as JSON so nothing references
> them) and for `Plan` (global config, reset via `deleteMany` + reseed-by-key in tests). All 15
> still carry the A1 columns.
>
> **Prisma limitation — nested includes aren't filtered.** The query extension only sees
> top-level operations, so a soft-deletable model read via a parent's `include` leaks. The
> customer menu's `category.items` (+ the category item `_count`) therefore filter
> `deletedAt: null` explicitly. Remaining low-traffic nested reads to revisit if those entities
> get soft-deleted often: `client.outlets` (platform), `store.adminUsers` (billing owner-email pick).

Adapted from the `mighty-one-service` pattern (every business row carries
`createdBy/updatedBy/deletedBy/deletedAt/isDeleted` + an `attach-actor` middleware),
fitted to this codebase's existing AsyncLocalStorage tenant context, JWT
`requireAdmin`, and impersonation (`imp`) claim.

## Goals

1. **Audit attribution** — for every mutable business row, record _who_ created /
   last updated / deleted it and _when_, including the operator behind an
   impersonated write.
2. **Soft delete** — deletes become recoverable and stop breaking historical
   references; deleted rows are hidden from normal reads by default, with an
   explicit escape hatch for "trash"/restore and reporting.

> **Note.** The `OrderItem.menuItemId → MenuItem (ON DELETE SET NULL)` FK that this once
> depended on is now **fixed** (separate migration). With that FK plus the denormalised
> name/price already on `OrderItem`, old tickets survive a hard-deleted menu item — so soft
> delete here is about **recoverable deletes + attribution**, not order-history integrity.

## Scope — which models get it

Apply to **user-mutated config/catalog/identity entities** — 15 models, against the
current schema:

- `Store`, `Client`, `AdminUser`
- `MenuCategory`, `MenuItem`, `OptionGroup`, `OptionChoice`
- `Combo`, `ComboGroup`, `ComboOption`
- `Table`, `Voucher`, `Member`, `RewardCatalog`, `Plan`

**Do NOT** add soft delete to:

- **Immutable ledgers** — `PointsLedger`, `StampLedger`, `RewardRedemption`,
  `VoucherRedemption`, `StockAdjustment` (append-only; corrections are reversing entries,
  never deletes).
- **Lifecycle-state records** — `Order`, `OrderItem` (VOID/CANCELLED status),
  `TableSession` (open/closed/cancelled), `Payment` (voided, not deleted). These already
  model "removal" as state.
- **Fiscal / immutable documents** — `Invoice`, `InvoiceCounter` (gapless sequence;
  invoices are cancelled / credit-noted via status, never deleted).
- **Operational/ephemeral** — `PrintJob`, `OtpChallenge`, `IdempotencyKey`,
  `LoyaltyJobRun`, and `AuditLog` itself.

Audit `createdAt`/`updatedAt` already exist on most models via `@default(now())` /
`@updatedAt`; this plan adds the actor columns and (where in scope) soft delete.

## Schema additions (per in-scope model)

```prisma
// audit attribution
createdById String?   // AdminUser.id of the creator (nullable: pre-existing/system rows)
updatedById String?   // AdminUser.id of the last writer
deletedById String?   // AdminUser.id who soft-deleted
deletedByImp String?  // operator email when the delete happened under impersonation
// soft delete
deletedAt   DateTime? // null = live; non-null = soft-deleted (the single source of truth)
@@index([deletedAt])
```

Decisions:

- **`deletedAt` is the source of truth**, not a separate `isDeleted` boolean (one
  field can't disagree with itself). `mighty-one` keeps both; we don't need the
  redundancy. A `deletedAt IS NULL` partial index keeps the default-scope filter fast.
- **No hard FK** on `createdById`/`updatedById`/`deletedById` (kept as plain `String?`)
  to avoid cascade entanglement when an admin is removed; resolve to a name in the DTO
  layer when displaying. Add relations later only if the admin console needs joins.
- **Capture the operator on impersonated writes** (`deletedByImp`, and analogously a
  stamp on create/update) so "view-as" actions are attributable to the real operator,
  not just the outlet's admin id.

## Actor context (the `attach-actor` analog)

We already run an AsyncLocalStorage store for tenant context and set `req.admin`
in `requireAdmin`. Extend, don't rebuild:

1. Add `actorId` (= `req.admin.id`) and `actorImp` (= `req.admin.imp`) to the existing
   ALS context, set in the same place tenant context is established.
2. A **Prisma Client extension** (`$extends({ query: { $allModels: {...} } })`) reads
   that context and:
   - on `create`/`createMany`: stamp `createdById` (+ `updatedById`);
   - on `update`/`updateMany`/`upsert`: stamp `updatedById`;
   - on `delete`/`deleteMany` **for in-scope models**: rewrite to an `update` setting
     `deletedAt = now()`, `deletedById = actorId`, `deletedByImp = actorImp`;
   - on `find*`/`count`/`aggregate` **for in-scope models**: inject `deletedAt: null`
     unless an `includeDeleted` flag is passed via context.

This is centralized and can't-forget, vs. `mighty-one`'s pass-`actor`-to-every-service
style (more boilerplate). Trade-off: an extension is "magic" — document it loudly.

### Pitfalls to handle (call these out in implementation)

- **Unique constraints vs. soft delete.** A soft-deleted row still occupies a unique
  slug/email/code. Convert affected uniques to **partial unique indexes**
  `... WHERE "deletedAt" IS NULL` (e.g. `Store.slug`, `AdminUser.email`, table code per
  store, voucher code per store). Prisma can't express partial uniques natively → raw
  SQL in the migration.
- **`findUnique` + soft-delete filter** is illegal (non-unique `where`). The extension
  must route those to `findFirst` when injecting `deletedAt`.
- **Raw queries bypass the extension** — audit any `$queryRaw`/`$executeRaw` and the
  reporting SQL manually.
- **Restore** = set `deletedAt = null` (+ re-check unique collisions against live rows).
- **Reports** decide inclusion explicitly; historical order data already isn't
  soft-deleted, so it's unaffected. Catalog joins from orders should read through
  `includeDeleted` so a removed item still renders on an old ticket.

## Rollout phases

- **A0 — fix the FK drift** (prerequisite): ✅ **done** — the `OrderItem.menuItemId` FK was
  added in a separate migration; schema and DB agree.
- **A1 — schema + actor context.** ✅ **done** — additive nullable columns +
  `@@index([deletedAt])` on the 15 models (migration `add_audit_soft_delete_columns`); the
  actor context already existed from the operator audit log. Migrate clean, suite green.
- **A2 — audit stamping.** ✅ **done** — `src/lib/auditExtension.ts` (a `$extends` query
  extension) stamps `createdById`/`updatedById` on create/createMany/update/updateMany/upsert
  of the audited models, from the ALS actor; top-level writes only; skips when no actor in
  context. Covered by `tests/integration/auditStamps.test.ts`.
- **A3 — soft delete.** 🟡 **core done** — `auditExtension` rewrites delete/deleteMany → soft
  (deletedAt + deletedById/deletedByImp) and injects the `deletedAt: null` read filter
  (findMany/findFirst/count/aggregate/groupBy; findUnique is post-filtered) for the 10 audited
  models; `withDeleted()` (ALS flag) reveals them. The customer menu's nested `category.items`
  filters explicitly. Covered by `auditStamps.test.ts`. **Remaining:** partial unique indexes
  (slug/email/code reuse — consented migration), `restore` endpoints + a Trash view, and an
  `AuditLog` row on delete.
- **A4 — dedicated `AuditLog` table** — 🟡 **partially shipped**: an `AuditLog` model +
  `writeAudit()` already record **platform/operator** actions (client/outlet/plan CRUD +
  impersonation). Remaining: have in-scope **tenant** deletes (and optionally create/update)
  also write an `AuditLog` row, for a mutation trail beyond per-row stamps.
- **A5 — PII purge cron** (optional): permanently delete `Member` rows soft-deleted
  > N days, for data-minimization/GDPR.

## Test plan (per phase)

- Writes stamp `createdById`/`updatedById`; impersonated writes stamp `deletedByImp`/
  operator.
- Delete sets `deletedAt` and the row disappears from default `find`/list/count.
- `includeDeleted` returns it; `restore` brings it back.
- Unique slug/email/code: reuse **blocked** among live rows, **allowed** after the
  holder is soft-deleted (partial index).
- Reports/Z-reading totals unchanged by soft deletes of catalog rows.
- Tenant isolation still holds (soft-delete filter composes with the tenant filter).
