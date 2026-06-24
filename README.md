# QR Ordering — Multi-Tenant Restaurant Ordering & POS Platform

A production-grade, multi-tenant SaaS for QR-code dine-in ordering and front-of-house
operations. Diners scan a table QR and order from their phone; staff run the floor from
an iPad POS; the kitchen ticket prints to a LAN thermal printer; and an operator console
manages tenants, outlets, plans and billing across the whole platform.

> No kitchen display screen — **the printer is the kitchen workflow.**

One Postgres-backed API serves three apps. Every tenant (restaurant outlet) is isolated
end-to-end, multiple outlets roll up under a client, and the platform is billed via Stripe.

---

## Architecture

```
   Diner phone                 Staff iPad                  Operator console
  (mobile :3000)              (admin :3001)                 (admin :3001)
        │                          │                              │
        │  scan QR → order         │  POS · floor · menu          │  clients · outlets
        │                          │  payments · reports          │  plans · impersonate
        ▼                          ▼                              ▼
   ┌───────────────────────────────────────────────────────────────────────┐
   │              Backend API  (Express 5 · TypeScript · :4000)             │
   │   multi-tenant · JWT auth · Zod-validated · Prisma 7 → PostgreSQL      │
   │   pino logs · Sentry · Prometheus metrics · Stripe billing            │
   └───────────────────────────────────────────────────────────────────────┘
        │  Order + PrintJob(PENDING)                  ▲
        ▼                                             │ polls, marks PRINTED/FAILED
   Print-job queue ───────────────► Local print agent ──► LAN thermal printer (TCP 9100)
                                    (ESC/POS · retries · dry-run)
```

| App | Folder | What it does | Stack | Dev URL |
|-----|--------|--------------|-------|---------|
| **Backend** | [`qr-ordering-backend`](./qr-ordering-backend) | API, multi-tenant data model, print-job queue, **local print agent**, billing | Express 5, TypeScript, Prisma 7, PostgreSQL, Zod 4 | http://localhost:4000 |
| **Customer** | [`qr-ordering-mobile`](./qr-ordering-mobile) | Diner QR ordering app | Next.js 16, React 19, Tailwind, Zustand | http://localhost:3000 |
| **Admin / POS** | [`qr-ordering-admin`](./qr-ordering-admin) | iPad staff POS **and** super-admin platform console | Next.js 16, React 19, TanStack Query, Radix/shadcn | http://localhost:3001 |

All three speak one documented contract: the backend serves a live **OpenAPI 3.1 spec**
generated from its Zod validators at `GET /api/openapi.json`, with **Swagger UI at `/api/docs`**.

---

## Features

**Diner ordering (mobile)**
- Scan-to-order per table; banner → category → item grid; item detail with image carousel
- Configurable options/modifiers, paid add-ons & special requests, per-item notes
- Featured items, standing discounts, sold-out states; vouchers; running "tab" across rounds

**Front-of-house POS (admin / iPad)**
- Floor as a live table grid (free / occupied, unsent-cart badges, covers/pax)
- Per-table POS workspace: build & send orders, edit unsent lines, price override (PIN-gated)
- Open/custom items, takeaway charges, per-item & whole-bill discounts, vouchers
- Void sent items, **make-payment** settlement (cash / card / e-wallet), move & combine tabs
- Kitchen reprints + print-health alerts; configurable PIN-gated actions

**Menu management**
- Drag-and-drop categories & items, move-between-category, featured ordering
- Image upload (local disk in dev, S3-compatible storage in prod), multi-image per item
- Per-item option groups (single/multi-select, min/max), standing discounts, sold-out toggle

**Reporting & tax**
- Daily **Z-reading** with covers and payment-method breakdowns
- Tax-inclusive pricing with multiple configurable taxes (SST/GST) + service charge, broken out on reports

**Kitchen printing**
- Durable print-job queue with retries, terminal-failure alerting, and a health probe
- Local agent renders ESC/POS to a LAN thermal printer (80mm/58mm, configurable IP/port, dry-run mode)

**Multi-tenant SaaS & platform**
- Tenant isolation: JWT carries the tenant, an `AsyncLocalStorage` request context scopes every query, and every by-id route is IDOR-guarded
- Clients → multiple outlets; owner can **switch outlets**; tenants are provisioned by the super-admin (no self-serve signup)
- Super-admin console: manage clients & outlets, **impersonate** (view-as) an outlet, plans/entitlements
- Operator **audit log** for platform actions and impersonation
- **Stripe billing**: subscription plans, free trial, entitlements (SaaS billing — distinct from diner payment, which is settled in-store)

---

## Production readiness

- **Security** — secrets validated at boot (the server **refuses to start** in production with weak `JWT_SECRET`/`PRINT_AGENT_API_KEY` or `CORS_ORIGIN="*"`); Helmet, locked-down CORS, rate limiting, request idempotency, login lockout, refresh tokens, bcrypt password hashing.
- **Reliability** — managed-Postgres-ready with a configurable connection pool, query/statement timeouts, graceful shutdown, liveness/readiness health probes, S3-compatible upload storage, and print-failure alerting webhooks.
- **Observability** — structured `pino` logs with request IDs, Sentry error tracking, and Prometheus metrics (`/metrics`, token-guardable).
- **Quality** — Vitest + Supertest integration tests, ESLint + Prettier (flat config), and GitHub Actions CI; Prisma migrations are explicit and reviewed via helper scripts + git hooks.

---

## Getting started

**Prerequisites:** Node ≥ 20.19, Docker (for local Postgres), and pnpm (`corepack enable` activates the version pinned in `package.json`).

Start the backend first, then the print agent, then the two apps. Postgres runs in Docker
on host port **5433**.

```bash
# 1) Backend + database  (terminal 1)
cd qr-ordering-backend
cp .env.example .env            # then set a strong JWT_SECRET for non-dev use
pnpm install
docker compose up -d            # local PostgreSQL on :5433
pnpm prisma:migrate          # apply migrations
pnpm db:seed                 # demo store + menu  (login: admin@example.com / password123)
pnpm db:demo                 # optional: a multi-outlet demo client (KLCC / Bangsar / Penang)
pnpm dev                     # API on :4000

# 2) Print agent  (terminal 2) — prints kitchen tickets to the console by default (dry-run)
cd qr-ordering-backend
pnpm print-agent

# 3) Customer app  (terminal 3)
cd qr-ordering-mobile
cp .env.example .env.local
pnpm install
pnpm dev                     # :3000  →  open /order/<tableCode>

# 4) Admin / POS  (terminal 4)
cd qr-ordering-admin
cp .env.example .env.local
pnpm install
pnpm dev                     # :3001  →  login admin@example.com / password123
```

> All three dev servers must be running to use the table link end-to-end: backend `:4000`,
> customer `:3000`, admin `:3001`.

### End-to-end smoke test

```
Diner submits an order on /order/<tableCode>
  → Backend creates the Order + a PENDING PrintJob (server-recalculated pricing)
  → Print agent prints the kitchen ticket (dry-run: console)
  → Staff see the tab on the Floor, can reprint, take payment, and close it
  → The day's sales appear on the Z-reading report
```

---

## Repository layout

This is a **monorepo** — three tightly-coupled apps in one repository, sharing the API
contract. Each app is self-contained (its own `package.json`, env, and build) and deploys
independently (e.g. Vercel for the two Next.js apps, a Node host for the backend).

```
qr-ordering/
├── qr-ordering-backend/    Express API · Prisma · print agent (print-agent/)
├── qr-ordering-admin/      Next.js POS + platform console
├── qr-ordering-mobile/     Next.js diner app
└── README.md
```

### Common backend scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | API with hot reload (`tsx watch`) |
| `pnpm verify` | `typecheck` + tests — run before pushing |
| `pnpm test` / `test:watch` | Vitest (+ Supertest) suite |
| `pnpm prisma:migrate` / `prisma:studio` | Dev migrations / DB browser |
| `pnpm db:migrate:create <name>` | Author a reviewed migration |
| `pnpm db:seed` / `db:demo` / `db:reset` | Seed demo data / demo client / reset DB |
| `pnpm lint` · `format` | ESLint · Prettier |

### Configuration

Each app ships a `.env.example` documenting every variable (DB URL, JWT secret, CORS,
print-agent key, S3, Sentry, Stripe, etc.). Copy it to `.env` (backend) / `.env.local`
(Next apps) and fill in values. The backend enforces strong secrets and locked-down CORS
when `NODE_ENV=production`.

---

## Roadmap

Production-grade today for ordering, POS, menu, reporting, tax/SC, multi-tenancy and billing.

Everything below is **pending**, sized **value · effort** (S < 1d · M 1–3d · L 1–2wk · XL > 2wk).

### 🎯 Next up — priority order
1. **Loyalty till UI (P4)** — attach/enrol a member by phone, show balance/tier, redeem at
   checkout. *Surfaces the shipped earn/redeem backend.* · high · M
2. **KDS + prep lifecycle** — extend `OrderStatus` to `NEW→PREPARING→READY→SERVED` + a kitchen
   display. The state machine every later kitchen feature (and mobile order-status) hangs off. · high · L
3. **Cash management** — MYR **5-sen (BNM) rounding** + shift / blind cash-up (X/Z) + drawer kick. · high · L

### Payments (the keystone gate)
The `lib/payments.ts` capture seam is ready; the real blocker is **company registration + PSP
merchant onboarding** (lead time) — start it in parallel so the adapter can land when business grows.
- ⬜ Real **DuitNow QR** payment adapter (PSP: Fiuu / iPay88 / Billplz) — unblocks the rest of this section. · high · L
- ⬜ **Pay-at-table** self-checkout on the diner app (view bill → pay → receipt) + **mobile tip entry**. · high · L
- ⬜ **FPX + e-wallet** (TNG / GrabPay / Boost / ShopeePay) via the same seam. · high · L
- ⬜ Card acquiring (terminal / SoftPOS) + configurable card surcharge. · med · L

### Kitchen & cash operations
- ⬜ **Live order status** on the diner app (`KITCHEN→READY→SERVED` over SSE). · high · M *(after KDS)*
- ⬜ End-of-day reconciliation (drawer-to-Z close-out, by method + variance). · high · M
- ⬜ Printer config UI + multi-printer **station routing** + failover. · med · M–L
- ⬜ Prep-SLA timers / late-ticket escalation; course firing (hold & fire). · med · M
- ⬜ Reservations & waitlist; spatial floor / table-plan editor. · med · L

### Malaysia compliance
- ⬜ **Real MyInvois production submission** — OAuth2 + UBL 2.1 signing + cert, consolidated B2C,
  cancel / credit-note (72h). Legally required as the 2026 mandate widens; the module is a
  **sandbox stub** today (production throws). · high · XL
- ⬜ **SST-02 filing export** + accounting export (AutoCount / SQL Account / Xero). · med · M–L
- ⬜ PDPA data-subject tooling (export / erase, with a fiscal-retention carve-out). · med · M

### Loyalty (remaining phases)
- ⬜ **P5 — diner self-serve** — public phone-OTP enrol + balance / rewards on the mobile app. · med · M
- ⬜ **P6 — tiers, expiry & bonuses** — point expiry (scheduled job), birthday / bonus campaigns,
  stamp cards, catalog-reward burn. · med · L
- ⬜ Gift cards / stored value; member-get-member referrals. · med · L

### Diner experience
- ⬜ **Surface the receipt** — `ReceiptView` + `getReceipt` already exist but nothing links to them;
  show a "View receipt" link on a settled tab. *Cheapest meaningful win.* · high · S
- ⬜ **Call-staff / request-bill** button (reuse the realtime SSE floor bus). · high · M
- ⬜ Structured **Halal / dietary** flags + quick filter (the free-text tag filter was removed; this
  needs real schema fields to be trustworthy). · med · M
- ⬜ **Multi-language** menu UI (BM / 中文 / Tamil). · med · L
- ⬜ **PWA / offline** shell + menu cache (flaky venue Wi-Fi). · med · M
- ⬜ Cart upsell / "frequently added"; split-by-diner; post-visit feedback + Google-review funnel. · med · M–L

### Platform, scale & integrations
- ⬜ **Consolidate CI to the repo root** — the per-app `.github/workflows/ci.yml` files are nested,
  so GitHub Actions never runs them; move to a root `.github/workflows/` with `paths:` filters. *Quick win.* · high · M
- ⬜ **MFA (TOTP)** for OWNER / platform-admin. · med · M
- ⬜ **Per-outlet shared brand catalogue** — menu / price / stock overrides on one catalogue (today
  each outlet is a separate menu copy). Best done *before* the 2nd tenant locks in the per-Store assumption. · high · XL
- ⬜ **SSE → Redis pub/sub** for horizontal scale (the floor bus is single-process today). · med · M
- ⬜ **Print-agent per-store provisioning** — `getDueJobs` is global today; scope per tenant when a
  2nd printing tenant onboards. · med · M
- ⬜ Public partner API (scoped keys) + signed webhooks; **delivery-aggregator ingestion**
  (Grab / foodpanda / ShopeeFood). · med–high · L–XL
- ⬜ Cross-outlet BI / analytics dashboard; white-label diner-app branding. · high · L
- ⬜ Billing depth: **annual plans, proration, per-client invoicing**, in-app dunning. · med · M
- ⬜ Menu versioning + scheduled publish; offline-POS resilience. · med · L–XL
- ⬜ **Audit columns + soft-delete** across tenant tables (platform actions already audited) — design
  parked in [`qr-ordering-backend/docs/audit-soft-delete-plan.md`](./qr-ordering-backend/docs/audit-soft-delete-plan.md).
- ⬜ Split the operator console into its own deployment at the first external tenant / 2nd operator
  (today intentionally embedded at `/platform/*`).

### API & docs
- 🟡 **Typed responses in the OpenAPI spec** — request bodies are generated from the Zod validators;
  response bodies are currently the generic `{ success, data }` envelope, being filled in per-endpoint.
