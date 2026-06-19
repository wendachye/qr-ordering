# QR Ordering Backend — API Contract

Base URL (set via `NEXT_PUBLIC_API_BASE_URL`): `http://localhost:4000/api`
All paths below are relative to that base. The backend runs on port **4000**.

## Response envelope

Every response is JSON.

- **Success** (HTTP 200/201): `{ "success": true, "data": <T> }`
- **Error** (HTTP 400/401/404/409/500): `{ "success": false, "error": { "message": string, "code"?: string, "details"?: any } }`

Always unwrap `.data` on success. On a non-2xx response, show `error.message`.

Notes:
- All money fields (`price`, `subtotal`, `total`, `unitPrice`, `totalPrice`) are **numbers** (e.g. `12`, not `"12.00"`).
- All date fields (`createdAt`, `updatedAt`, `printedAt`) are **ISO 8601 strings**.

---

## Public (customer) — no auth

### GET /public/tables/:tableCode
Validates a table. 404 if missing, 400 if inactive.
```json
{ "table": { "id": "...", "name": "Table 1", "code": "TBL001", "isActive": true },
  "store": { "id": "...", "name": "Demo Restaurant", "slug": "demo-restaurant" } }
```

### GET /public/menu?tableCode=TBL001
```json
{
  "store": { "id": "...", "name": "Demo Restaurant", "slug": "demo-restaurant" },
  "table": { "id": "...", "name": "Table 1", "code": "TBL001", "isActive": true },
  "categories": [
    { "id": "...", "name": "Rice", "sortOrder": 1,
      "items": [
        { "id": "...", "name": "Tonkotsu Ramen", "description": "string|null",
          "imageUrls": ["/uploads/abc.png"], "price": 22, "isAvailable": true,
          "sortOrder": 1, "categoryId": "...",
          "optionGroups": [
            { "id": "...", "name": "Spice level", "required": true, "minSelect": 1, "maxSelect": 1,
              "choices": [ { "id": "...", "name": "Mild", "priceDelta": 0 },
                           { "id": "...", "name": "Hot", "priceDelta": 0 } ] },
            { "id": "...", "name": "Add-ons", "required": false, "minSelect": 0, "maxSelect": 3,
              "choices": [ { "id": "...", "name": "Extra Chashu", "priceDelta": 5 },
                           { "id": "...", "name": "Ajitama Egg", "priceDelta": 3 } ] }
          ] }
      ] }
  ]
}
```
Items include sold-out ones (`isAvailable: false`) so the UI can show a sold-out state.

### POST /orders
Request (`optionChoiceIds` = the selected `OptionChoice` ids for that line):
```json
{ "tableCode": "TBL001", "note": "optional order note",
  "items": [ { "menuItemId": "...", "quantity": 2, "note": "optional",
               "optionChoiceIds": ["choiceId1", "choiceId2"] } ] }
```
Response (HTTP 201): prices are recalculated server-side; quantity 1..99.
```json
{ "id": "order_id", "orderNumber": 1001, "status": "NEW", "tableName": "Table 1",
  "subtotal": 24, "total": 24, "totalItems": 2, "createdAt": "2026-06-03T12:00:00.000Z" }
```
Errors: 404 unknown table, 400 inactive table / unknown item / sold-out item.

**Item options:** each menu item may carry `optionGroups`. For each group the customer selects
`OptionChoice`s, sent as `optionChoiceIds` on that line.
- `maxSelect: 1` → single-select (radio); `maxSelect > 1` → multi-select (checkboxes), at most `maxSelect`.
- `required: true` → at least `minSelect` must be chosen (server returns **400** otherwise).
- Line price = item `price` + sum of selected `choice.priceDelta`; the server recomputes this + the order total.
- Only send choice ids belonging to that item's groups (foreign ids → **400**).

---

## Admin auth

### POST /admin/auth/login
Request: `{ "email": "admin@example.com", "password": "password123" }`
Response: `{ "token": "<jwt>", "user": { "id": "...", "email": "...", "name": "string|null" } }`

### GET /admin/auth/me  (header: `Authorization: Bearer <token>`)
Response: `{ "id": "...", "email": "...", "name": "string|null" }`

All `/admin/**` routes require the `Authorization: Bearer <token>` header. 401 if missing/invalid.

---

## Admin orders

### GET /admin/orders?status=NEW|COMPLETED|CANCELLED   (status optional)
Sorted NEW-first, then most recent. Array:
```json
[ { "id": "...", "orderNumber": 1001, "status": "NEW", "tableName": "Table 1",
    "totalItems": 3, "total": 28, "printStatus": "PENDING|PRINTING|PRINTED|FAILED|null",
    "createdAt": "..." } ]
```

### GET /admin/orders/:id
```json
{ "id": "...", "orderNumber": 1001, "status": "NEW", "note": "string|null",
  "tableId": "...", "tableName": "Table 1", "tableCode": "TBL001",
  "subtotal": 28, "total": 28, "totalItems": 3, "createdAt": "...", "updatedAt": "...",
  "items": [ { "id": "...", "menuItemId": "...", "name": "Tonkotsu Ramen", "quantity": 1,
              "unitPrice": 30, "totalPrice": 30, "note": "string|null",
              "selectedOptions": [ { "group": "Spice level", "choice": "Hot", "priceDelta": 0 } ] } ],
  "printJobs": [ { "id": "...", "status": "PRINTED", "error": "string|null",
                  "retryCount": 0, "createdAt": "...", "printedAt": "string|null" } ] }
```

### PATCH /admin/orders/:id/status
Request: `{ "status": "NEW" | "COMPLETED" | "CANCELLED" }`
Response: the full order detail (same shape as GET /admin/orders/:id).

### POST /admin/orders/:id/reprint
Response: `{ "printJobId": "...", "status": "PENDING" }`. Show toast "Kitchen ticket reprint queued."

---

## Admin tables

### GET /admin/tables
```json
[ { "id": "...", "name": "Table 1", "code": "TBL001", "isActive": true,
    "orderCount": 3, "createdAt": "...", "updatedAt": "..." } ]
```

### POST /admin/tables
Request: `{ "name": "Patio 1", "code": "PATIO1", "isActive": true }` (isActive default true; `code`
must be unique — letters/numbers/`-`/`_` only). Response (201): the created table. **409** if the code is taken.

### PATCH /admin/tables/:id
Request: any subset of `{ name, code, isActive }`. Response: updated table.

### DELETE /admin/tables/:id
Response: `{ "id": "..." }`. **409** if the table already has orders (deactivate it instead).

## Staff order entry (admin placing an order)

Staff place an order on a table's behalf by calling the **public** `POST /orders` with the chosen
`tableCode` — it creates the order + PENDING print job exactly like a customer order, so the kitchen
ticket prints the same. Build the menu (with options) from `GET /public/menu?tableCode=<code>` and the
line items as `{ menuItemId, quantity, note?, optionChoiceIds }`. The table must be **active**.

---

## Admin menu — categories

### GET /admin/menu/categories
```json
[ { "id": "...", "name": "Rice", "sortOrder": 1, "isActive": true,
    "itemCount": 2, "createdAt": "...", "updatedAt": "..." } ]
```

### POST /admin/menu/categories
Request: `{ "name": "Desserts", "sortOrder": 4, "isActive": true }` (sortOrder default 0, isActive default true)
Response (201): the created category `{ id, name, sortOrder, isActive, createdAt, updatedAt, storeId }`

### PATCH /admin/menu/categories/:id
Request: any subset of `{ "name", "sortOrder", "isActive" }`. Response: updated category.

### DELETE /admin/menu/categories/:id
Response: `{ "id": "..." }`. **409** if the category still has items (message explains it).

---

## Admin menu — items

### GET /admin/menu/items?categoryId=...   (categoryId optional)
```json
[ { "id": "...", "categoryId": "...", "categoryName": "Rice", "name": "Nasi Lemak Ayam",
    "description": "string|null", "imageUrls": ["/uploads/abc.png"], "price": 12,
    "isAvailable": true, "sortOrder": 1, "createdAt": "...", "updatedAt": "..." } ]
```

### POST /admin/menu/items
Request: `{ "categoryId": "...", "name": "...", "description": "optional", "price": 12,
           "isAvailable": true, "sortOrder": 0, "imageUrls": ["/uploads/abc.png"] }`
           (isAvailable default true, sortOrder default 0, imageUrls optional, max 8)
Response (201): the item DTO (same shape as the GET list element).

### PATCH /admin/menu/items/:id
Request: any subset of `{ categoryId, name, description, price, isAvailable, sortOrder, imageUrls }`.
(`imageUrls` replaces the whole array when provided.) Response: updated item DTO.

### DELETE /admin/menu/items/:id
Response: `{ "id": "..." }`. **409** if the item is referenced by existing orders.

### PATCH /admin/menu/items/:id/sold-out
Request: `{ "isAvailable": false }`. Response: updated item DTO. Use this for the quick sold-out toggle.

---

## Item images (uploads)

Items carry an `imageUrls: string[]` (max 8). To attach an image: upload the file, then save
the returned url into the item's `imageUrls` via item create/update.

### POST /admin/uploads/image   (admin auth; `multipart/form-data`, field name `file`)
Uploads one image — **PNG, JPEG, WEBP or GIF, max 5 MB**. Do NOT set `Content-Type` yourself
(let the browser set the multipart boundary). Send `Authorization: Bearer <token>`.
Response (201): `{ "url": "/uploads/<filename>" }`. Errors: 401 (no token), 400 (bad type / >5MB).

**Resolving image URLs for display:** stored urls are relative (`/uploads/x.png`). Prefix them
with the backend origin — the API base URL **without** the trailing `/api`
(e.g. `http://localhost:4000` + `/uploads/x.png`). If a url already starts with `http`, use as-is.
Served images are public (no auth needed to GET them).

---

## Seed data (available after `npm run db:seed` on the backend)
- Store: **Demo Restaurant**
- Tables: **TBL001**..**TBL010** (Table 1..10)
- Categories: Rice, Noodles, Drinks
- Items: Nasi Lemak Ayam (12), Fried Rice (10), Mee Goreng (9), Kopi Ice (4), Teh Ice (4)
- Admin login: **admin@example.com** / **password123**
