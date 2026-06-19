# QR Ordering — Admin

iPad-optimized staff admin web app for the QR-code restaurant ordering MVP. Staff
use it to run the floor — a live grid of tables, each with its own running tab
(session) of ordered rounds — settle or cancel tabs, reprint kitchen tickets, and
manage the menu (categories and items, including a quick sold-out toggle).

Built with **Next.js 15** (App Router), **React 19**, **TypeScript**,
**Tailwind CSS v3.4**, **TanStack Query v5** (polling), and **React Hook Form + Zod**.

## Prerequisites

- Node.js 18+ (built and tested on Node 24)
- pnpm
- The **backend API must be running on `http://localhost:4000`** and **seeded**
  (run `pnpm db:seed` on the backend). Without it, login and all data requests fail.

## Setup

```bash
pnpm install
```

### Environment

Create `.env.local` (an example is provided in `.env.example`):

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

The code falls back to `http://localhost:4000/api` if the variable is unset.

## Run (development)

```bash
pnpm dev
```

The app runs on **http://localhost:3001** (a different port from the customer app).
Open http://localhost:3001 — you'll be redirected to the login page.

## Login

Use the seeded admin credentials:

- **Email:** `admin@example.com`
- **Password:** `password123`

## Production build

```bash
pnpm build
pnpm start   # serves on http://localhost:3001
```

## What you can do

- **Floor** (`/admin/floor`): a live grid of table tiles, polling every 5 seconds.
  A free tile starts an order (→ `/admin/orders/new?table=CODE`, the POS). An
  occupied tile shows the running total, round count, and how long it's been open;
  tap it to open the session.
- **Session detail** (`/admin/sessions/[id]`): the running tab for one table. Each
  round (one order = one kitchen ticket) lists its items, options, and notes with a
  per-round print status and a Reprint button. Actions: **Add items**, **Close
  table** (settle), and **Cancel session**.
- **History** (`/admin/history`): closed & cancelled sessions, filterable (All /
  Closed / Cancelled). Tap a card to view its detail.
- **Menu** (`/admin/menu`): combined overview of categories and items with the
  sold-out toggle and quick add/edit/delete.
- **Categories** (`/admin/menu/categories`): create, edit, delete, set active/inactive.
- **Items** (`/admin/menu/items`): create, edit, delete, filter by category, toggle sold out.

The old **Orders** and **Tables** modules were merged into the Floor: `/admin/orders`
and `/admin/tables` now redirect to `/admin/floor`.

## How tabs work

Each table has at most one **OPEN** session — a running tab. The same
`POST /api/orders` endpoint backs both the customer app and the POS: it opens the
table's session on the first order and appends a new round to it on every order
after that. Each round is one order and prints its own kitchen ticket stamped
**"ROUND N"**.

## Auth notes

The JWT is stored in `localStorage`. It is validated on load via `GET /admin/auth/me`.
Any `401` response clears the token and redirects to `/admin/login`. All `/admin/**`
pages except the login page are protected.

## Scripts

| Script          | Description                              |
| --------------- | ---------------------------------------- |
| `pnpm dev`   | Dev server on port 3001                  |
| `pnpm build` | Production build                         |
| `pnpm start` | Serve the production build on port 3001  |
| `pnpm lint`  | Next.js lint                             |
