# Mayalu Wears API Reference

Base URL: `http://localhost:3000/api/v1`  
Swagger UI: `http://localhost:3000/api/docs`  
OpenAPI JSON: `http://localhost:3000/api/docs-json`

All responses follow a standard envelope:
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "code": "ERROR_CODE", "message": "..." }, "path": "/...", "timestamp": "..." }
```

---

## Auth `/auth`

### POST /auth/otp/send
Send OTP to Nepal mobile number.
```json
Request:  { "phone": "+9779841234567", "purpose": "login" }
Response: { "message": "OTP sent successfully. Valid for 5 minutes." }
Errors:   400 OTP_COOLDOWN (wait N seconds), 400 invalid phone format
Rate:     5 req/min per IP
```

### POST /auth/otp/verify
Verify OTP and receive auth cookies.
```json
Request:  { "phone": "+9779841234567", "otp": "123456", "purpose": "login" }
Response: { "isNewUser": false, "user": { "id": "...", "phone": "...", "status": "active" } }
Cookies:  access_token (HttpOnly, 15m), refresh_token (HttpOnly, 30d, path=/api/v1/auth/refresh)
Errors:   401 INVALID_OTP, 401 OTP_MAX_ATTEMPTS, 403 ACCOUNT_SUSPENDED
```

### POST /auth/register
Complete registration after OTP verification.
```json
Request:  { "phone": "+9779841234567", "fullName": "Sita Rai", "email": "sita@example.com" }
Response: { "user": { ... } }
Errors:   409 PHONE_TAKEN, 400 PHONE_NOT_VERIFIED
```

### POST /auth/refresh
Rotate refresh token (cookie-based).
```json
Cookie:   refresh_token (sent automatically)
Response: { "message": "Tokens rotated successfully" }
Errors:   401 INVALID_REFRESH_TOKEN, 401 REFRESH_TOKEN_EXPIRED, 403 REFRESH_TOKEN_REUSE_DETECTED
```

### POST /auth/logout  `🔒`
Revoke tokens and clear cookies.
```json
Response: { "message": "Logged out successfully" }
```

### GET /auth/me  `🔒`
Get current user profile.
```json
Response: { "id": "...", "phone": "...", "fullName": "...", "isPhoneVerified": true, ... }
```

---

## Shops `/shops`

### POST /shops  `🔒`
Register a new shop (one per user).
```json
Request:  { "name": "Sita Fashion", "slug": "sita-fashion", "description": "...", "planSlug": "starter" }
Response: { "id": "...", "name": "...", "slug": "...", "status": "pending" }
Errors:   403 PHONE_NOT_VERIFIED, 409 SHOP_ALREADY_EXISTS, 409 SLUG_TAKEN, 404 PLAN_NOT_FOUND
```

### GET /shops/:slug
Get shop by slug (public).
```json
Response: { "id": "...", "name": "...", "slug": "...", "status": "active", "owner": {...} }
Errors:   404 SHOP_NOT_FOUND
```

### PATCH /shops/:id  `🔒`
Update shop details.

### GET /shops/:id/subscription  `🔒`
Get current plan & subscription status.

### GET /shops/:id/usage  `🔒`
Get resource usage (products, storage, staff).

### GET /shops/:id/members  `🔒`
Get shop team members.

---

## Categories `/categories`

### GET /categories
Get full category tree (nested).
```json
Response: [{ "id":"...", "name":"Women", "slug":"women", "path":"women", "children":[
  { "name":"Kurti", "slug":"kurti", "path":"women.kurti", "children":[] }
]}]
```

### GET /categories/:slug
Get single category by slug.

### GET /categories/:id/subtree-ids
Get all subcategory IDs using ltree `<@` operator (O(log n)).

### GET /categories/:id/breadcrumb
Get ancestor path from root to this category.

---

## Attributes `/attributes`

### GET /attributes
Get all attributes with their options.

### GET /attributes/code/:code
Get attribute by code (e.g. `color`, `size`, `fabric`).

### GET /attributes/category/:categoryId
Get attributes mapped to a category, including `isVariantAttribute` and `isRequired` flags.  
`isVariantAttribute=true` → used to build the Color×Size variant matrix.  
`isVariantAttribute=false` → single-value product metadata.

---

## Products `/products` and `/cms/products`

### GET /products  (public)
Browse active products with filters.
```
Query params:
  q          - full-text search (tsvector)
  categoryId - filters to entire subtree via ltree
  shopId     - filter by shop
  minPrice, maxPrice
  isFeatured, isTrending
  sort       - newest|price_asc|price_desc|popular
  page, limit
```

### GET /products/:slug  (public)
Get product detail. Logs view async (non-blocking).

### POST /cms/products  `🔒`
Create product (checks plan limit first).
```json
Request: { "name":"Embroidered Kurti","slug":"emb-kurti-001","categoryId":"...","description":"..." }
Errors:  403 PLAN_LIMIT_REACHED, 409 SLUG_TAKEN, 404 CATEGORY_NOT_FOUND
```

### PATCH /cms/products/:id  `🔒`
Update product fields.

### POST /cms/products/:id/publish  `🔒`
Publish product.  
Requires: ≥1 media AND ≥1 active variant.
```json
Errors: 400 NO_IMAGES, 400 NO_VARIANTS
```

### POST /cms/products/:id/archive  `🔒`
Archive active product.

### DELETE /cms/products/:id  `🔒`
Delete draft product only.
```json
Errors: 400 NOT_DRAFT (archive instead)
```

### POST /cms/products/:id/variants  `🔒`
Add variant (SKU globally unique).
```json
Request: {
  "sku": "MW-KURTI-RED-L",
  "name": "Red - L",
  "price": 1299,
  "attributeValues": [
    { "attributeId": "...", "attributeOptionId": "..." },
    { "attributeId": "...", "attributeOptionId": "..." }
  ]
}
Errors: 409 SKU_TAKEN, 403 PLAN_LIMIT_REACHED
```

### GET /cms/products/:id/media/presign  `🔒`
Get Cloudinary presigned URL for direct browser upload.
```json
Query:    filename, contentType
Response: { "uploadUrl":"https://api.cloudinary.com/...", "publicId":"...", "signature":"...", ... }
```

### POST /cms/products/:id/media  `🔒`
Save uploaded media reference after Cloudinary upload.
```json
Request: { "url":"https://res.cloudinary.com/...", "publicId":"...", "fileSizeBytes": 204800 }
Note:    First media is auto-set as isPrimary=true
```

---

## Inventory `/inventory`

### POST /inventory/warehouses  `🔒`
Create warehouse for a shop.

### GET /inventory/warehouses  `🔒`
List shop warehouses.

### GET /inventory  `🔒`
Full inventory list with variant/warehouse detail.

### GET /inventory/low-stock  `🔒`
Items where quantityAvailable ≤ lowStockThreshold.

### POST /inventory/adjust  `🔒`
Adjust stock (append-only transaction log).
```json
Request: { "variantId":"...", "warehouseId":"...", "delta": 50, "type":"restock", "notes":"..." }
Types:   restock|adjustment|damage|return|opening
Errors:  404 WAREHOUSE_NOT_FOUND, 400 INSUFFICIENT_STOCK, 400 NO_INVENTORY_RECORD
```

### GET /inventory/:inventoryId/transactions  `🔒`
Get last 100 transaction records for an inventory row.

---

## Delivery `/delivery`

### GET /delivery/zones
List all active delivery zones.

### POST /delivery/check
Check serviceability + cost for a pincode.
```json
Request:  { "destPincode":"44600", "shopId":"...", "sizeClass":"SMALL" }
Response: {
  "result": "serviceable",
  "buyerMessage": "Delivery in 2-3 business days",
  "availableCarriers": [{ "name":"SundaraCarrier", "minDays":2, "maxDays":3, "costNpr":150 }],
  "minDeliveryCostNpr": "150",
  "fastestDeliveryDays": 2,
  "fromCache": false
}
```
Cache TTL: 24 hours (O(1) lookup on repeat).

---

## Cart `/cart`  `🔒`

### GET /cart
Get cart with all items, current prices, and total.

### POST /cart/items
Add item (checks stock, merges quantity if variant exists).
```json
Request: { "variantId":"...", "quantity": 2 }
Errors:  404 VARIANT_NOT_FOUND, 400 PRODUCT_UNAVAILABLE, 400 INSUFFICIENT_STOCK
```

### PATCH /cart/items/:itemId
Update quantity (re-validates stock).

### DELETE /cart/items/:itemId
Remove single item.

### DELETE /cart
Clear entire cart.

---

## Wishlist `/wishlist`  `🔒`

### GET /wishlist — Get wishlist with product details.
### POST /wishlist/:productId — Add product (idempotent).
### DELETE /wishlist/:productId — Remove product.

---

## Orders `/orders`  `🔒`

### POST /orders
Place order. **Fully atomic transaction:**
1. Creates order + items (snapshots)
2. Deducts inventory for each variant
3. Logs inventory transactions
4. Updates product totalSold
5. Applies coupon (if provided)
6. Clears cart
7. Sends SMS (async, non-blocking)

```json
Request: {
  "addressId": "...",
  "paymentMethod": "cod",
  "couponCode": "SAVE10",
  "customerNotes": "Please pack carefully"
}
Response: { "id":"...", "orderNumber":"MW-2025-847291", "totalAmount":"2498", "status":"pending" }
Errors:  404 ADDRESS_NOT_FOUND, 400 EMPTY_CART, 400 ITEMS_UNAVAILABLE, 400 COUPON_NOT_FOUND
```

### GET /orders
List my orders with pagination.
```
Query: status, page, limit
```

### GET /orders/:id
Get order detail with items + status history.

---

## Coupons `/coupons`  `🔒`

### POST /coupons/validate
Validate coupon and preview discount.
```json
Request:  { "code": "SAVE10", "orderAmount": 1500 }
Response: { "couponId":"...", "discountType":"percentage", "discountAmount": 150, "finalAmount": 1350 }
Errors:   400 COUPON_NOT_FOUND|COUPON_EXPIRED|MIN_ORDER_REQUIRED|COUPON_ALREADY_USED
```

---

## Reviews `/reviews`

### GET /reviews/product/:productId  (public)
Get approved reviews for a product.

### POST /reviews/product/:productId  `🔒`
Create review. Requires delivered order containing this product.
```json
Request: { "orderId":"...", "rating": 5, "comment": "Beautiful kurti!" }
Errors:  400 ORDER_NOT_DELIVERED, 400 PRODUCT_NOT_IN_ORDER, 400 REVIEW_EXISTS
```

---

## Banners `/banners`  (public)

### GET /banners
```
Query: position (hero|category|promo), shopId
```
Returns active banners within date range.

---

## Notifications `/notifications`  `🔒`

### GET /notifications — Get my notifications (latest 50).
### PATCH /notifications/:id/read — Mark one as read.
### PATCH /notifications/read-all — Mark all as read.

---

## Users `/users`  `🔒`

### GET /users/me — Get profile.
### PATCH /users/me — Update name/email.
### GET /users/me/addresses — List delivery addresses.
### POST /users/me/addresses — Add address.

---

## Admin `/admin`  🔑 X-Admin-Key header required

### GET /admin/dashboard
Parallel stats: users, shops, orders, pending orders, products, revenue.

### GET /admin/orders
List all orders with user info. Query: `page`, `limit`, `status`.

### PATCH /admin/orders/:id/status
Update order status. Triggers SMS on `shipped`.
```json
Request: { "status":"shipped", "note":"Dispatched via Sundara Carrier", "paymentReference":"ESW-123" }
```

### GET /admin/shops — List all shops with subscription info.
### PATCH /admin/shops/:id/status — Verify/suspend/activate shop.

### POST /admin/coupons — Create coupon.
### PATCH /admin/coupons/:id/toggle — Toggle active state.

### POST /admin/banners — Create banner.
### PATCH /admin/banners/:id/toggle — Toggle active.

### GET /admin/reviews/pending — Get reviews awaiting moderation.
### PATCH /admin/reviews/:id/approve — Approve review + update product rating.
