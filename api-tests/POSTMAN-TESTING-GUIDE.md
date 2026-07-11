# Mayalu Wears — Postman Testing Guide

> **This `api-tests` folder is the primary/main test suite for this API** — it's
> the source of truth for expected request/response shapes across every
> endpoint. The Jest suites under `src/**/__tests__` cover unit-level service
> logic, but this collection is what documents and exercises full endpoint
> behavior. **Whenever an endpoint's request/response contract changes,
> update `generate-postman.js` and re-run it (see "Regenerating the
> collection" below) in the same change — don't let this drift out of sync.**

This folder contains three files that together give you a complete,
ready-to-run Postman test suite for every endpoint in the Mayalu Wears API.

---

## Files

| File | Purpose |
|---|---|
| `generate-postman.js` | **Single source of truth.** Plain Node script (zero dependencies). All 72 endpoints, every example request/response, and all collection variables are defined here. Re-run it any time an endpoint changes. |
| `mayalu-wears.postman_collection.json` | **Import this into Postman.** Pre-built output from `generate-postman.js` — 17 folders, 72 requests, 259 saved examples. |
| `mayalu-wears.postman_environment.json` | **Import this as the environment.** Sets `baseUrl`, `adminKey`, and `testPhone`. |

---

## Quick Start (5 minutes)

### Step 1 — Import into Postman

1. Open Postman → click **Import** (top-left)
2. Drag-and-drop **both** JSON files, or click *Choose Files* and select them
3. You will see:
   - **Collection**: `Mayalu Wears API` (17 folders)
   - **Environment**: `Mayalu Wears - Local`
4. Select `Mayalu Wears - Local` from the environment dropdown (top-right corner)

### Step 2 — Configure the environment

Click the **eye icon** next to the environment dropdown and set:

| Variable | Value |
|---|---|
| `baseUrl` | `http://localhost:3000/api/v1` (already set) |
| `adminKey` | Paste the value of `ADMIN_SECRET_KEY` from your `.env` file |
| `testPhone` | Any Nepal mobile number (default `+9779800000001` works fine) |

### Step 3 — Start the server

```bash
pnpm start:dev
# → http://localhost:3000/api/docs  (Swagger UI)
# → http://localhost:3000/api/v1    (API root)
```

Also make sure Postgres is running: `docker compose up postgres -d`

### Step 4 — Run the Auth flow first

Every authenticated endpoint relies on the session cookie set during login.
Run these **in order** (just click Send on each):

1. **Auth → Send OTP** — sends OTP to your test phone
2. **Auth → Verify OTP & Login** — sends the OTP back; the server replies with
   `Set-Cookie: access_token=...; refresh_token=...` and Postman stores both
   cookies automatically in its cookie jar
3. That's it — every later request in the collection now sends the cookie

> **Getting the OTP in development:**
> With `SMS_PROVIDER=mock` set in your `.env`, the OTP is printed to the
> server console (`[MOCK SMS] → +9779800000001: Your Mayalu Wears OTP is: 123456`).
> Copy it from there.

---

## How to use the collection

### Viewing examples

Every request has multiple pre-saved **Examples** — open the dropdown next to
the **Send** button or look in the right panel under **Examples**:

- `✅ 200 / 201` — success cases (sometimes multiple, e.g. empty vs non-empty)
- `❌ 400 Validation error` — DTO field validation failures (with the exact NestJS error message)
- `❌ 401 Unauthorized` — what you get without a session cookie
- `❌ 403 Forbidden` — authenticated but lacking permission
- `❌ 404 Not Found` — resource doesn't exist
- `❌ 409 Conflict` — duplicate slug, already-exists, etc.
- Business-logic errors — e.g. `EMPTY_CART`, `COD_NOT_AVAILABLE`, `SKU_TAKEN`, `PLAN_LIMIT_REACHED`

### Auto-chaining variables

Creation requests (Create Shop, Create Product, Add Variant, Place Order, etc.)
have a small script in the **Tests** tab that auto-saves the returned `id` into
a collection variable. This means once you run *Create Shop*, `{{shopId}}` is
filled in everywhere — inventory, products, warehouses all just work.

Variables auto-set by which request:

| Variable | Set by |
|---|---|
| `userId` | Auth → Get Current User |
| `shopId` | Shops → Create Shop |
| `categoryId` | Categories → Get Category Tree |
| `colorAttributeId` | Attributes → Get Attribute by Code (color) |
| `colorOptionId` | Attributes → Get Attribute by Code (color) |
| `productId` | Products → [CMS] Create Product |
| `variantId` | Products → [CMS] Add Variant |
| `warehouseId` | Inventory → Create Warehouse |
| `inventoryId` | Inventory → Get Inventory List |
| `addressId` | Users → Add Delivery Address |
| `cartItemId` | Cart → Add Item to Cart |
| `orderId` | Orders → Place Order |
| `couponId` | Admin → [Admin] Create Coupon |
| `bannerId` | Admin → [Admin] Create Banner |
| `reviewId` | Admin → [Admin] Get Pending Reviews |
| `notificationId` | Notifications → Get Notifications |

### Running a full end-to-end flow

Run requests top-to-bottom in this order for a complete happy-path test:

```
Auth
  1. Send OTP
  2. Verify OTP & Login         ← sets session cookie + userId
  3. Get Current User

Shops
  4. Create Shop                ← sets shopId

Categories
  5. Get Category Tree          ← sets categoryId

Attributes
  6. Get Attribute by Code      ← sets colorAttributeId + colorOptionId

Products
  7. [CMS] Create Product       ← sets productId
  8. [CMS] Add Variant          ← sets variantId
  9. [CMS] Add Media
  10. [CMS] Publish Product

Inventory
  11. Create Warehouse          ← sets warehouseId
  12. Adjust Stock (+50 units)
  13. Get Inventory List        ← sets inventoryId

Users
  14. Add Delivery Address      ← sets addressId

Cart
  15. Add Item to Cart          ← sets cartItemId
  16. Get Cart                  ← verify item is there

Delivery
  17. Check Serviceability      ← verify address is deliverable

Orders
  18. Place Order               ← sets orderId

Reviews
  19. Create Review

Admin
  20. [Admin] Dashboard         ← verify platform stats
  21. [Admin] Update Order Status (to "shipped")
```

### Running with Postman Collection Runner

1. Click the **▶ Run** button at the top of the collection
2. Select which folder(s) to run, or run all
3. Set iteration count, delay between requests, and data file (optional)
4. Click **Run Mayalu Wears API**

The Runner shows pass/fail per request, total time, and lets you export results.

---

## Running specific scenarios

### Test only public endpoints (no login needed)

Run just these folders — they all have `skipAuth: true`:
- **Categories**, **Attributes**, **Banners**, **Delivery** → *Get Delivery Zones*

### Test admin endpoints

All Admin requests already have the `x-admin-key: {{adminKey}}` header set.
Just make sure `adminKey` is filled in the environment.

### Test validation errors

Every POST/PATCH request has validation-error examples pre-saved. To send them:
1. Click the request
2. Click the **Examples** dropdown
3. Select any `❌ 400 Validation error` example
4. Click **Try** — Postman copies the example body into the request
5. Click **Send**

---

## Regenerating the collection

If you add a new endpoint to the NestJS backend, add its definition to
`generate-postman.js` and re-run:

```bash
node api-tests/generate-postman.js
```

This regenerates both JSON files. Re-import into Postman (it merges automatically
if the collection name matches, or you can delete the old one and re-import).

The generator is pure Node.js — no npm install needed, uses only built-in `fs`
and `crypto`.

---

## Coverage summary

| Module | Requests | Examples |
|---|---|---|
| Auth | 6 | 22 |
| Shops | 6 | 20 |
| Categories | 4 | 7 |
| Attributes | 3 | 6 |
| Products | 11 | 22 |
| Inventory | 6 | 16 |
| Delivery | 2 | 10 |
| Cart | 5 | 20 |
| Wishlist | 3 | 8 |
| Orders | 3 | 18 |
| Coupons | 1 | 11 |
| Reviews | 2 | 10 |
| Banners | 1 | 3 |
| Notifications | 3 | 5 |
| Users | 4 | 12 |
| Navigation | 1 | 3 |
| Admin | 11 | 27 |
| **Total** | **72** | **259** |

Example types per endpoint: success (1–3 variants), validation errors,
401 unauthorized, 403 forbidden, 404 not found, 409 conflict, and
business-logic errors (stale-price warnings, plan limits, COD restrictions,
coupon exhaustion, stock depletion, etc.).
