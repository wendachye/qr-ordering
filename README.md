# QR Ordering MVP

A minimalist QR-code restaurant ordering system. A customer scans a table QR code,
orders from their phone, the backend saves the order and queues a print job, and a
local print agent prints the kitchen ticket to a **ZyWell ZY301** LAN printer. Staff
use an iPad web admin to view / reprint / complete / cancel orders.

> No kitchen display. **The printer is the kitchen workflow.**

## The flow

```
Customer phone (mobile)                 Staff iPad (admin)
        |                                       |
        v                                       v
   POST /api/orders  ───────────────►  Backend API + PostgreSQL
        |                                       ^
        | creates Order + PrintJob(PENDING)     | GET/PATCH orders, reprint
        v                                       |
   Print job queue  ◄──── polls ──── Local print agent ──► ZyWell ZY301 (TCP 9100)
```

## Repositories

| Folder | What | Stack | Dev URL |
|--------|------|-------|---------|
| [`qr-ordering-backend`](./qr-ordering-backend) | API, DB, print job queue, **local print agent** | Express, TypeScript, Prisma, PostgreSQL | http://localhost:4000 |
| [`qr-ordering-mobile`](./qr-ordering-mobile) | Customer QR ordering app | Next.js, Tailwind, Zustand | http://localhost:3000 |
| [`qr-ordering-admin`](./qr-ordering-admin) | iPad staff admin | Next.js, Tailwind, TanStack Query | http://localhost:3001 |

- **[API_CONTRACT.md](./API_CONTRACT.md)** — the full request/response contract shared by all three.

## Run order

Start the backend first (it's the foundation), then the print agent, then the apps.

```bash
# 1) Backend  (terminal 1)
cd qr-ordering-backend
npm install
docker compose up -d          # local PostgreSQL
npm run prisma:migrate
npm run db:seed
npm run dev                    # API on :4000

# 2) Print agent  (terminal 2)  — dry-run prints tickets to the console by default
cd qr-ordering-backend
npm run print-agent

# 3) Mobile  (terminal 3)
cd qr-ordering-mobile
npm install
npm run dev                    # :3000  →  open /order/TBL001

# 4) Admin  (terminal 4)
cd qr-ordering-admin
npm install
npm run dev                    # :3001  →  login admin@example.com / password123
```

## First working milestone

```
Mobile order submit
  → Backend creates order
  → Backend creates print job (PENDING)
  → Print agent prints kitchen ticket (dry-run: console)
  → Admin can view and reprint the order
```

## MVP scope

**Included:** customer QR ordering, iPad admin, backend API, PostgreSQL + Prisma,
kitchen print job queue, local print agent (ZyWell ZY301 LAN), menu management,
sold-out toggle, order list, reprint, simple order statuses (NEW / COMPLETED / CANCELLED).
Admin uses **polling** (no WebSocket).

**Deliberately skipped:** online payment, customer login/receipt, kitchen display,
realtime/WebSocket, modifiers/variants, image upload, inventory, multi-branch,
loyalty, analytics, printer/table management UI.
