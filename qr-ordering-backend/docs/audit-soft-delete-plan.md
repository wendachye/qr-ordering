# Plan — Audit attribution + soft delete

**Status:** proposed (no code yet). Schema changes here require explicit consent to run.

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

> **Synergy with a bug we just found.** `npm run db:migrate:create` surfaced drift:
> the live dev DB is missing the `OrderItem.menuItemId → MenuItem (ON DELETE SET NULL)`
> FK. That FK exists _because_ a menu item can be removed while old order lines still
> point at it. Soft delete is the cleaner answer: menu items are never hard-deleted,
> so order history keeps its reference intact. (Fix the FK drift separately and first.)

## Scope — which models get it

Apply to **user-mutated config/catalog/identity entities**:

- `Store`, `Client`, `AdminUser`
- `MenuCategory`, `MenuItem`, `MenuItemOptionGroup`, `MenuItemOptionChoice`
- `RestaurantTable`, `Voucher`, `Member`, `RewardCatalog`, `Plan`

**Do NOT** add soft delete to:

- **Immutable ledgers** — `PointsLedger`, `StampLedger`, `RewardRedemption`
  (append-only; corrections are reversing entries, never deletes).
- **Lifecycle-state records** — `Order`, `OrderItem` (VOID/CANCELLED status),
  `TableSession` (open/closed/cancelled). These already model "removal" as state.
- **Operational/ephemeral** — `PrintJob`, `OtpChallenge`, `IdempotencyKey`,
  `LoyaltyJobRun`.

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

- **A0 — fix the FK drift** (separate, prerequisite): generate + apply the missing
  `OrderItem.menuItemId` FK so the schema and DB agree before adding more.
- **A1 — schema + actor context.** Add the columns (additive, nullable, backfill-free);
  plumb `actorId`/`actorImp` into ALS. No behavior change. _Verify:_ migrate clean,
  suite green.
- **A2 — audit stamping.** Prisma extension stamps `createdById`/`updatedById` on
  writes (deletes still hard for now). _Verify:_ writes carry the actor; impersonated
  writes carry the operator.
- **A3 — soft delete.** Per in-scope model: rewrite delete → soft, inject the read
  filter, add partial unique indexes, add `restore` endpoints + an admin "Trash" view.
  Heaviest phase; roll out model-by-model with tests each step.
- **A4 — dedicated `AuditLog` table** (optional, the full `audit-log` analog):
  append-only `{ actorId, actorImp, action, entity, entityId, diff Json, requestId, ip,
createdAt }` for a complete mutation trail beyond per-row stamps. Pairs with the
  existing request-id + pino logging.
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
