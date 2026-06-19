# QR Ordering — Mobile (Customer)

The customer-facing mobile web app for a QR-code restaurant ordering MVP.
Customers scan the QR code on their table, browse the menu, build a cart, and
submit an order — all from their phone's browser.

Built with **Next.js 15** (App Router) + **React 19** + **TypeScript**,
**Tailwind CSS v3.4**, and **Zustand v5** (with `persist` for a per-table cart).

## Customer flow

```
Scan QR → /order/[tableCode] → table validated + menu loaded
        → add items to cart → review cart → submit order
        → /order/[tableCode]/success/[orderId] → cart clears
```

## Prerequisites

- **Node.js 20+** (developed on Node 24) and npm 10+.
- The **backend API** running on `http://localhost:4000` and seeded
  (`npm run db:seed` in the backend). See the seed data below for valid table
  codes. The mobile app does not work without the backend.

## Setup

```bash
npm install
```

### Environment

Copy the example env file and adjust if your backend runs elsewhere:

```bash
cp .env.example .env.local
```

`.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

The code falls back to `http://localhost:4000/api` if the variable is unset.

## Run (development)

```bash
npm run dev
```

Then, with the backend running and seeded, open:

> http://localhost:3000/order/TBL001

`TBL001` is "Table 1" in the seed data. Valid demo table codes are
**TBL001**..**TBL010**.

The home page (`http://localhost:3000`) has a "Try the demo" link to the same
route.

## Build (production)

```bash
npm run build
npm run start
```

## Routes

| Route                                       | Purpose                              |
| ------------------------------------------- | ------------------------------------ |
| `/`                                         | Landing / demo redirect              |
| `/order/[tableCode]`                        | Menu — validates table, lists items  |
| `/order/[tableCode]/cart`                   | Cart — edit, note, submit order      |
| `/order/[tableCode]/success/[orderId]`      | Order confirmation                   |

## API endpoints used (Public / customer)

- `GET /public/tables/:tableCode` — validate the table.
- `GET /public/menu?tableCode=...` — load store, table, categories, items.
- `POST /orders` — submit the order.

All responses use the `{ success, data }` envelope; helpers in `lib/api.ts`
unwrap `.data` and throw `error.message` on failure.

## Project structure

```
app/
  layout.tsx                                  Root layout + globals
  page.tsx                                    Landing / demo
  not-found.tsx                               404
  order/[tableCode]/
    page.tsx, MenuView.tsx                    Menu page
    cart/page.tsx, CartView.tsx               Cart page
    success/[orderId]/page.tsx                Success page
components/
  menu/CategoryTabs.tsx, MenuItemCard.tsx, ItemModal.tsx
  cart/StickyCartBar.tsx, CartItemRow.tsx, CartSummary.tsx
  layout/MobileShell.tsx
  common/Button.tsx, Card.tsx, QuantityStepper.tsx,
         LoadingState.tsx, ErrorState.tsx, EmptyState.tsx
lib/
  api.ts        Typed fetch helpers (envelope unwrapping)
  types.ts      Shared types mirroring the API contract
  currency.ts   RM price formatting
store/
  cart.ts       Zustand cart store (persisted per table)
```

## Notes

- The cart is persisted in `localStorage` and **keyed per table** — switching
  to a different table code starts a fresh cart.
- Sold-out items (`isAvailable: false`) are shown but disabled and cannot be
  added.
- Money values are numbers from the API and formatted as `RM12.00` in the UI.
- Accent color: **emerald** (`#059669`).
