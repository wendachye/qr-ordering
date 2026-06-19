# qr-ordering-backend

Backend API + local print agent for the QR ordering MVP.

- **Express + TypeScript** REST API
- **PostgreSQL + Prisma** for persistence
- **JWT** admin auth, **Zod** validation
- A **local print agent** (in `print-agent/`) that polls for print jobs and sends ESC/POS kitchen tickets to a **ZyWell ZY301** LAN printer over TCP.

## Prerequisites

- Node.js 20+ (built with v24)
- Docker Desktop (for the local PostgreSQL), **or** any PostgreSQL you point `DATABASE_URL` at.

## Quick start

```bash
# 1. Install dependencies
pnpm install

# 2. Start PostgreSQL (Docker). Skip if you use your own Postgres.
docker compose up -d

# 3. Apply the database schema
pnpm prisma:migrate      # creates tables + a migration history
#   (or, for a quick throwaway DB without migration files:)
# pnpm prisma:push

# 4. Seed demo data (store, tables, menu, admin user)
pnpm db:seed

# 5. Run the API (http://localhost:4000)
pnpm dev

# 6. In a SECOND terminal, run the print agent
pnpm print-agent
```

Health check: <http://localhost:4000/health>

### Seed credentials & data

- Admin login: **admin@example.com** / **password123**
- Tables: **TBL001**..**TBL010**
- Menu: Rice (Nasi Lemak Ayam, Fried Rice), Noodles (Mee Goreng), Drinks (Kopi Ice, Teh Ice)

## Environment

`.env` (API) — see `.env.example`:

| Var                   | Default                                                                   | Notes                                                         |
| --------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `DATABASE_URL`        | `postgresql://postgres:postgres@localhost:5433/qr_ordering?schema=public` | Postgres connection (host port 5433 — see docker-compose.yml) |
| `PORT`                | `4000`                                                                    | API port                                                      |
| `JWT_SECRET`          | —                                                                         | Change in production                                          |
| `JWT_EXPIRES_IN`      | `7d`                                                                      | Token lifetime                                                |
| `PRINT_AGENT_API_KEY` | `secret-key`                                                              | Must match the print agent                                    |
| `CORS_ORIGIN`         | `*`                                                                       | `*` or a comma-separated list of origins                      |
| `ORDER_NUMBER_BASE`   | `1000`                                                                    | First order number is base + 1 = 1001                         |

`print-agent/.env` — see `print-agent/.env.example`:

| Var                      | Default                 | Notes                                        |
| ------------------------ | ----------------------- | -------------------------------------------- |
| `API_BASE_URL`           | `http://localhost:4000` | Backend base (no `/api`)                     |
| `PRINT_AGENT_API_KEY`    | `secret-key`            | Must match the API                           |
| `PRINTER_IP`             | `192.168.1.50`          | ZyWell ZY301 LAN IP                          |
| `PRINTER_PORT`           | `9100`                  | Raw/JetDirect TCP port                       |
| `POLL_INTERVAL_MS`       | `2000`                  | Poll frequency                               |
| `PRINTER_DRY_RUN`        | `true`                  | Print tickets to console instead of hardware |
| `PRINTER_CHARS_PER_LINE` | `48`                    | 48 for 80mm, 32 for 58mm                     |

> **Testing without a printer:** keep `PRINTER_DRY_RUN=true`. The agent will fetch
> pending jobs, mark them PRINTING → PRINTED, and print the ticket text to the
> console. Set it to `false` and configure `PRINTER_IP` to print on real hardware.

## API routes

Response envelope: `{ "success": true, "data": ... }` or `{ "success": false, "error": { "message", "code" } }`.

**Public (customer)**

- `GET  /api/public/tables/:tableCode`
- `GET  /api/public/menu?tableCode=TBL001`
- `POST /api/orders`

**Admin auth** (JWT)

- `POST /api/admin/auth/login`
- `GET  /api/admin/auth/me`

**Admin orders**

- `GET   /api/admin/orders`
- `GET   /api/admin/orders/:id`
- `PATCH /api/admin/orders/:id/status`
- `POST  /api/admin/orders/:id/reprint`

**Admin menu**

- `GET|POST /api/admin/menu/categories`, `PATCH|DELETE /api/admin/menu/categories/:id`
- `GET|POST /api/admin/menu/items`, `PATCH|DELETE /api/admin/menu/items/:id`
- `PATCH /api/admin/menu/items/:id/sold-out`

**Print agent** (header `x-print-agent-key`)

- `GET  /api/print-agent/jobs/pending`
- `POST /api/print-agent/jobs/:id/mark-printing`
- `POST /api/print-agent/jobs/:id/mark-printed`
- `POST /api/print-agent/jobs/:id/mark-failed`

See the OpenAPI spec at `/api/openapi.json` (Swagger UI at `/api/docs`).

## Scripts

| Script                        | What                                    |
| ----------------------------- | --------------------------------------- |
| `pnpm dev`                 | Run the API with hot reload (tsx watch) |
| `pnpm build` / `pnpm start` | Compile to `dist/` and run with Node    |
| `pnpm print-agent`         | Run the local print agent               |
| `pnpm print-agent:watch`   | Print agent with hot reload             |
| `pnpm prisma:migrate`      | Create/apply a migration                |
| `pnpm prisma:push`         | Push schema without migration files     |
| `pnpm prisma:studio`       | Open Prisma Studio                      |
| `pnpm db:seed`             | Seed demo data                          |
| `pnpm db:reset`            | Drop, re-migrate, and re-seed           |
| `pnpm lint` / `lint:fix`   | ESLint (flat config); `--fix` autofixes |
| `pnpm format` / `:check`   | Prettier write / check-only             |
| `pnpm typecheck`           | `tsc --noEmit` (no build output)        |
| `pnpm verify`              | `typecheck` + full test suite           |
| `pnpm db:migrate:create`   | Generate a migration's SQL for review   |
| `pnpm db:migrate:deploy`   | Apply pending migrations                |
| `pnpm db:migrate:status`   | Show applied vs pending migrations      |
| `pnpm hooks:install`       | Enable the local git pre-push hook      |

### Code quality & git hooks

Lint + format are configured via `eslint.config.mjs` and `.prettierrc`. After cloning,
run the one-time hook install:

```bash
pnpm hooks:install   # git config core.hooksPath .githooks
```

The `.githooks/pre-push` hook then runs `lint`, `format:check`, and `verify`
(typecheck + tests) before every `git push`, so broken or unformatted code never
leaves your machine.

### Migration workflow

Migrations are generated for review and applied as a separate, explicit step — we
never auto-apply schema changes to a database.

```bash
# 1. Edit prisma/schema.prisma
# 2. Generate the SQL (diffs the live dev DB against the schema; writes a file, applies nothing)
pnpm db:migrate:create add_member_birthday
# 3. Review prisma/migrations/<ts>_add_member_birthday/migration.sql
#    (add any data backfill by hand)
# 4. Apply it
pnpm db:migrate:deploy
# 5. Refresh the Prisma client
pnpm prisma:generate
```

> Prisma config lives in `prisma.config.ts` (schema path + seed command), replacing
> the deprecated `prisma` block in `package.json`.

## Project structure

```
src/
  app.ts                 Express app wiring
  server.ts              HTTP server bootstrap
  config/env.ts          Validated environment config
  lib/                   prisma, jwt, response helpers, print payload builder
  middleware/            auth (JWT), printAgentAuth, error handler
  modules/
    public/              table + menu (customer)
    orders/              create order (+ print job)
    auth/                admin login / me
    admin/               admin orders (list/detail/status/reprint)
    menu/                category + item CRUD + sold-out
    print-jobs/          print agent queue API
  validators/            Zod schemas
prisma/
  schema.prisma
  seed.ts
print-agent/
  src/
    index.ts             poll loop
    api.ts               backend client + config
    printer.ts           TCP socket to ZY301
    formatter.ts         ESC/POS kitchen ticket
    utils.ts             sleep, logging, date formatting
```
