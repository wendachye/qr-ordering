# Reliability & operations

How the backend stays up and recovers, plus the ops runbook for production.

## Health probes

| Endpoint                           | Purpose                  | Checks                                             |
| ---------------------------------- | ------------------------ | -------------------------------------------------- |
| `GET /health` / `GET /health/live` | Liveness (restart probe) | process is up — no dependencies                    |
| `GET /health/ready`                | Readiness (LB routing)   | DB reachable **and** not draining; `503` otherwise |

Point the orchestrator's **liveness** probe at `/health/live` and its **readiness**
probe at `/health/ready`. Only ready instances receive traffic.

## Graceful shutdown

On `SIGTERM`/`SIGINT` the server:

1. flips readiness to draining → `/health/ready` returns `503` so the LB stops
   routing new requests;
2. (production) waits ~3s for the LB to observe the `503`;
3. stops accepting connections, lets in-flight requests finish, disconnects Prisma;
4. hard-exits after a 10s backstop if draining stalls.

On boot it **waits for the database** (`SELECT 1`, 10 retries w/ backoff) before
listening, so a slow-waking managed PG doesn't crash-loop the container.

## Database (managed Postgres)

- Use a **managed Postgres** (RDS/Cloud SQL/Neon/Supabase) — automated backups,
  failover, patching. Point `DATABASE_URL` at it.
- **Connection pooling:** serverless/many-instance deployments should connect
  through a pooler (PgBouncer / RDS Proxy / Neon pooled endpoint). Under the
  Prisma 7 pg driver adapter, cap per-instance connections with **`DB_POOL_MAX`**
  (the old `?connection_limit=N` URL param is no longer honored) and bound waits
  with `DB_CONNECTION_TIMEOUT_MS` / `DB_STATEMENT_TIMEOUT_MS`.
- Run migrations on deploy with `npx prisma migrate deploy` (never `migrate dev`
  in production).

## Backups

- **Primary:** rely on the managed provider's automated snapshots + PITR.
- **Logical (belt-and-suspenders):** [`scripts/backup.sh`](scripts/backup.sh)
  runs `pg_dump` to a timestamped gzip. Schedule it (cron/Cloud Scheduler) and
  ship the output to object storage with lifecycle expiry.
- **Restore:** `gunzip -c backup.sql.gz | psql "$DATABASE_URL"` (test restores
  into a scratch DB regularly — an untested backup is not a backup).

## Uploads (S3)

Container filesystems are ephemeral, so production stores images in object
storage. Set `STORAGE_DRIVER=s3` plus `S3_BUCKET`, `S3_REGION`,
`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (and `S3_ENDPOINT` for R2/MinIO,
`S3_PUBLIC_URL` for a CDN). Dev defaults to `local` (disk under `/uploads`).
The backend refuses to start if `STORAGE_DRIVER=s3` is missing required config.

## Kitchen printing

The print agent runs on-prem and polls for due jobs. Reliability built in:

- **Auto-retry:** a `FAILED` job is re-handed to the agent after a backoff,
  up to `PRINT_MAX_RETRIES` (default 5).
- **No duplicates on race:** jobs are claimed atomically, so two agents polling
  at once never both print the same ticket.
- **Stuck recovery (at-least-once):** a job stuck in `PRINTING` (agent crashed
  mid-print) is reclaimed after 2 min. If the crash happened _after_ the physical
  print, the reclaim reprints it — a duplicate ticket is preferred over a lost one.
- **Terminal alert:** when a job exhausts retries, `notifyOps` logs and (if
  `ALERT_WEBHOOK_URL` is set) POSTs to Slack/PagerDuty/etc.
- **Staff visibility:** the admin **Floor** shows a banner when tickets fail;
  `GET /api/admin/orders/print-health` exposes per-tenant counts for monitoring.
  Staff re-print from the order's history.

## Alerting

Set `ALERT_WEBHOOK_URL` to receive operational alerts (currently print
exhaustion). Payload: `{ level, event, message, context, ts }`.

## Tests & CI

- **Run:** `npm test` (Vitest). Unit tests cover pure helpers; integration +
  e2e tests run the real app in-process (supertest) against a **test database**.
- **Test DB:** `.env.test` points at `qr_ordering_test`. Create it once locally:
  `createdb qr_ordering_test && DATABASE_URL=...test npx prisma migrate deploy &&
... npx tsx prisma/seed.ts`. CI provisions a fresh Postgres service and sets
  `DATABASE_URL` (which overrides `.env.test`).
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) per app — backend runs
  generate → migrate → seed → typecheck → test → build against a Postgres
  service; admin/mobile run typecheck → build.

## Deploy (containers)

- **Backend image:** multi-stage [`Dockerfile`](Dockerfile) (build → slim
  runtime, non-root). Run **migrations as a release step** (`npx prisma migrate
deploy`) before rolling the new image — never inside the request path.
- **Staging:** a parallel environment with its own managed PG + secrets; deploy
  every main build there, run smoke checks (`/health/ready`), then promote.
- Frontends (`qr-ordering-admin`, `qr-ordering-mobile`) are Next.js apps — deploy
  to a Node host or a platform (e.g. Vercel); set `NEXT_PUBLIC_API_BASE_URL`.

## Observability

- **Structured logs:** JSON via pino on stdout (ship to your aggregator). Every
  line carries `requestId` + `storeId` for correlation; secrets are redacted.
  Tune with `LOG_LEVEL`.
- **Request IDs:** every response gets an `X-Request-Id` (an inbound one is
  honoured); unexpected `500`s include it in the body for support correlation.
- **Error tracking:** set `SENTRY_DSN` to report unhandled errors (plus
  `unhandledRejection` / `uncaughtException`) to Sentry; unset = disabled.
- **Metrics:** Prometheus at `GET /metrics` (default Node/process metrics +
  `http_request_duration_seconds`, `orders_placed_total`,
  `print_job_failures_total`). Gate with `METRICS_TOKEN` and/or network policy.

## Billing (Stripe)

Each tenant (Store) has one subscription. New tenants start a `BILLING_TRIAL_DAYS`
trial; operational admin routes are gated by `requireActiveSubscription`. The
account area — auth, billing, and settings — stays reachable. An inactive tenant
gets `402`, and the admin app routes them to **/admin/billing** to subscribe.

- **Checkout / portal:** `POST /api/admin/billing/checkout` (plan) and
  `/portal` create Stripe sessions; the admin redirects to the returned URL.
- **Webhook:** `POST /api/stripe/webhook` (raw body, signature-verified with
  `STRIPE_WEBHOOK_SECRET`) syncs `customer.subscription.*` events onto the Store.
  Register this URL in the Stripe dashboard.
- **Config:** set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `APP_URL`. Unset = billing disabled
  (trial-only) — useful for dev/self-host.
