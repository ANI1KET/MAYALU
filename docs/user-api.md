# Mayalu Wears — User API Reference

This document covers all **end-user / customer-facing APIs** available in the Mayalu Wears platform.  
These endpoints are designed for public storefront browsing, customer account management, cart, checkout, order tracking, wishlist, product reviews, and notifications.

---

## Overview & Conventions

- **Base URL**: `http://localhost:3000/api/v1`
- **Swagger Documentation**: `http://localhost:3000/api/docs`
- **OpenAPI Spec**: `http://localhost:3000/api/docs-json`

### Authentication & Headers
- **Public Endpoints**: No authentication required. Marked as `[Public]`.
- **Protected User Endpoints**: Require an active session via the HttpOnly `access_token` cookie (or Bearer Token header). Marked as `🔒 Protected`.

### Standard Response Envelope
All API endpoints return JSON conforming to standard response envelopes:

**Success Response (2xx):**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response (4xx / 5xx):**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error description",
    "errors": [
      { "field": "fieldName", "message": "Validation detail" }
    ]
  },
  "path": "/api/v1/...",
  "timestamp": "2026-07-21T12:00:00.000Z"
}
```

---

## Table of Contents

1. [Authentication (`/auth`)](#1-authentication-auth)
2. [User Profile & Addresses (`/users`)](#2-user-profile--addresses-users)
3. [Products & Storefront (`/products`)](#3-products--storefront-products)
4. [Categories (`/categories`)](#4-categories-categories)
5. [Product Attributes (`/attributes`)](#5-product-attributes-attributes)
6. [Shopping Cart (`/cart`)](#6-shopping-cart-cart)
7. [Wishlist (`/wishlist`)](#7-wishlist-wishlist)
8. [Orders & Checkout (`/orders`)](#8-orders--checkout-orders)
9. [Coupons (`/coupons`)](#9-coupons-coupons)
10. [Product Reviews (`/reviews`)](#10-product-reviews-reviews)
11. [Delivery & Serviceability (`/delivery`)](#11-delivery--serviceability-delivery)
12. [Promotional Banners (`/banners`)](#12-promotional-banners-banners)
13. [Shops (`/shops`)](#13-shops-shops)
14. [Notifications (`/notifications`)](#14-notifications-notifications)
15. [Navigation & User Menu (`/navigation`)](#15-navigation--user-menu-navigation)

---

## 1. Authentication `/auth`

### POST `/auth/otp/send` `[Public]`
Send a 6-digit OTP code to a Nepal mobile number.
- **Rate Limit**: 5 requests/min per IP. 60-second cooldown between resends.
- **Request Body**:
  ```json
  {
    "phone": "+9779841234567",
    "purpose": "login"
  }
  ```
  *(Note: `purpose` can be `"login"` or `"register"`. Phone is auto-normalized).*
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "message": "OTP dispatched to +9779841234567. Valid for 5 minutes.",
      "cooldownSeconds": 60
    }
  }
  ```
- **Error Codes**: `400 OTP_COOLDOWN`, `429 TOO_MANY_REQUESTS`, `400 VALIDATION_ERROR`

---

### POST `/auth/otp/verify` `[Public]`
Verify OTP code and authenticate.
- **Behavior**:
  - For `purpose: "login"`: Authenticates the user and sets HttpOnly cookies (`access_token` - 15 mins, `refresh_token` - 30 days).
  - For `purpose: "register"`: Verifies phone ownership without creating user or setting cookies (call `POST /auth/register` next).
- **Request Body**:
  ```json
  {
    "phone": "+9779841234567",
    "otp": "123456",
    "purpose": "login"
  }
  ```
- **Response (200 OK - Login)**:
  ```json
  {
    "success": true,
    "data": {
      "isNewUser": false,
      "user": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "phone": "+9779841234567",
        "email": "sita@example.com",
        "fullName": "Sita Rai",
        "avatarUrl": null,
        "status": "active",
        "isPhoneVerified": true,
        "isEmailVerified": false,
        "lastLoginAt": "2026-07-21T12:00:00.000Z",
        "createdAt": "2026-01-01T00:00:00.000Z",
        "updatedAt": "2026-07-21T12:00:00.000Z"
      }
    }
  }
  ```
- **Error Codes**: `401 INVALID_OTP`, `401 OTP_MAX_ATTEMPTS`, `403 ACCOUNT_SUSPENDED`

---

### POST `/auth/register` `[Public]`
Complete user registration after phone verification. Sets JWT authentication cookies.
- **Request Body**:
  ```json
  {
    "phone": "+9779841234567",
    "fullName": "Sita Rai",
    "email": "sita@example.com"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "phone": "+9779841234567",
        "email": "sita@example.com",
        "fullName": "Sita Rai",
        "avatarUrl": null,
        "status": "active",
        "isPhoneVerified": true,
        "isEmailVerified": false,
        "createdAt": "2026-07-21T12:00:00.000Z"
      }
    }
  }
  ```
- **Error Codes**: `400 PHONE_NOT_VERIFIED`, `409 PHONE_TAKEN`

---

### POST `/auth/refresh` `[Public]`
Rotate access token and refresh token via HttpOnly cookies.
- **Cookie Required**: `refresh_token`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "message": "Session refreshed successfully."
    }
  }
  ```
- **Error Codes**: `401 MISSING_REFRESH_TOKEN`, `401 INVALID_REFRESH_TOKEN`, `401 REFRESH_TOKEN_EXPIRED`, `403 REFRESH_TOKEN_REUSE_DETECTED`

---

### POST `/auth/logout` `🔒 Protected`
Revoke active session and clear authentication cookies.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "message": "Logged out successfully."
    }
  }
  ```

---

### GET `/auth/me` `🔒 Protected`
Get profile of the currently logged-in user.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "phone": "+9779841234567",
      "email": "sita@example.com",
      "fullName": "Sita Rai",
      "avatarUrl": null,
      "status": "active",
      "isPhoneVerified": true,
      "isEmailVerified": false,
      "lastLoginAt": "2026-07-21T12:00:00.000Z",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-07-21T12:00:00.000Z"
    }
  }
  ```

---

## 2. User Profile & Addresses `/users`

### GET `/users/me` `🔒 Protected`
Get current user details.
- **Response (200 OK)**: Same output format as `GET /auth/me`.

---

### PATCH `/users/me` `🔒 Protected`
Update profile details (name, email, avatar URL).
- **Request Body**:
  ```json
  {
    "fullName": "Sita Rai",
    "email": "sita.new@example.com",
    "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v12345/avatar.jpg"
  }
  ```
- **Response (200 OK)**: Returns updated user profile object.

---

### GET `/users/me/addresses` `🔒 Protected`
Get all saved delivery addresses for the user, sorted with the default address first.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        "type": "home",
        "fullName": "Sita Rai",
        "phone": "+9779841234567",
        "addressLine": "Thamel, House 23",
        "landmark": "Near Thamel Chowk",
        "city": "Kathmandu",
        "district": "Bagmati",
        "pincode": "44600",
        "zone": "inside_valley",
        "isDefault": true
      }
    ]
  }
  ```

---

### POST `/users/me/addresses` `🔒 Protected`
Save a new delivery address for the user.
- **Request Body**:
  ```json
  {
    "type": "home",
    "fullName": "Sita Rai",
    "phone": "+9779841234567",
    "addressLine": "Thamel, House 23",
    "landmark": "Near Thamel Chowk",
    "city": "Kathmandu",
    "district": "Bagmati",
    "pincode": "44600",
    "zone": "inside_valley",
    "isDefault": true
  }
  ```
- **Allowed `type` values**: `"home"`, `"work"`, `"other"`
- **Allowed `zone` values**: `"inside_valley"`, `"outside_valley"`, `"remote"`
- **Response (201 Created)**: Returns the created address object.

---

## 3. Products & Storefront `/products`

### GET `/products` `[Public]`
Browse and search active products with full-text search, filtering, and pagination.
- **Query Parameters**:
  - `q` *(optional)*: Full-text search string (e.g., `saree`, `kurti`)
  - `categoryId` *(optional)*: Category UUID (includes subcategory subtree via ltree)
  - `shopId` *(optional)*: Filter by specific shop UUID
  - `minPrice` / `maxPrice` *(optional)*: Price range filter (NPR)
  - `sort` *(optional)*: Sort order — `newest`, `price_asc`, `price_desc`, `popular`, `rating`
  - `isFeatured` *(optional)*: `true` / `false`
  - `isTrending` *(optional)*: `true` / `false`
  - `page` *(optional, default 1)*: Page number
  - `limit` *(optional, default 20, max 100)*: Items per page
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "data": [
        {
          "id": "b11e8400-e29b-41d4-a716-446655440000",
          "name": "Nepali Silk Saree - Red",
          "slug": "nepali-silk-saree-red",
          "shortDescription": "Handcrafted silk saree from Kathmandu",
          "status": "active",
          "avgRating": "4.50",
          "totalSold": 120,
          "isFeatured": true,
          "isTrending": true,
          "primaryImageUrl": "https://res.cloudinary.com/demo/image/upload/saree.jpg",
          "minPriceNpr": "1299.00",
          "maxPriceNpr": "1599.00",
          "activeVariantCount": 3
        }
      ],
      "meta": {
        "total": 45,
        "page": 1,
        "limit": 20,
        "totalPages": 3,
        "hasNextPage": true,
        "hasPrevPage": false
      }
    }
  }
  ```

---

### GET `/products/:slug` `[Public]`
Get full details of an active product by its URL slug. Asynchronously increments the product view counter.
- **Path Parameter**: `slug` (e.g. `nepali-silk-saree-red`)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "b11e8400-e29b-41d4-a716-446655440000",
      "name": "Nepali Silk Saree - Red",
      "slug": "nepali-silk-saree-red",
      "shortDescription": "Handcrafted silk saree from Kathmandu",
      "status": "active",
      "avgRating": "4.50",
      "totalSold": 120,
      "isFeatured": true,
      "isTrending": true,
      "primaryImageUrl": "https://res.cloudinary.com/demo/image/upload/saree.jpg",
      "minPriceNpr": "1299.00",
      "maxPriceNpr": "1599.00",
      "activeVariantCount": 3,
      "variants": [
        {
          "id": "v11e8400-e29b-41d4-a716-446655440001",
          "sku": "SAREE-RED-L",
          "name": "Red - L",
          "price": "1299.00",
          "compareAtPrice": "1500.00",
          "isActive": true,
          "imageUrl": "https://res.cloudinary.com/demo/image/upload/saree-red.jpg"
        }
      ],
      "media": [
        {
          "id": "m11e8400-e29b-41d4-a716-446655440001",
          "url": "https://res.cloudinary.com/demo/image/upload/saree.jpg",
          "type": "image",
          "isPrimary": true,
          "sortOrder": 0
        }
      ]
    }
  }
  ```
- **Error Codes**: `404 Product NOT_FOUND`

---

## 4. Categories `/categories`

### GET `/categories` `[Public]`
Get the entire category hierarchy as a nested tree structure.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "c11e8400-e29b-41d4-a716-446655440000",
        "name": "Women",
        "slug": "women",
        "path": "women",
        "parentId": null,
        "imageUrl": "https://res.cloudinary.com/demo/women.jpg",
        "sortOrder": 0,
        "children": [
          {
            "id": "c22e8400-e29b-41d4-a716-446655440000",
            "name": "Kurti",
            "slug": "kurti",
            "path": "women.kurti",
            "parentId": "c11e8400-e29b-41d4-a716-446655440000",
            "imageUrl": null,
            "sortOrder": 0,
            "children": []
          }
        ]
      }
    ]
  }
  ```

---

### GET `/categories/:slug` `[Public]`
Get details of a single category by slug.
- **Path Parameter**: `slug` (e.g. `women`)
- **Response (200 OK)**: Returns category details object.

---

### GET `/categories/:id/subtree-ids` `[Public]`
Get all descendant category UUIDs for a given category using PostgreSQL `ltree`.
- **Path Parameter**: `id` (Category UUID)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      "c11e8400-e29b-41d4-a716-446655440000",
      "c22e8400-e29b-41d4-a716-446655440000"
    ]
  }
  ```

---

### GET `/categories/:id/breadcrumb` `[Public]`
Get the ordered ancestor path from root category to the target category.
- **Path Parameter**: `id` (Category UUID)
- **Response (200 OK)**: Returns array of Category objects from top root to specified category.

---

## 5. Product Attributes `/attributes`

### GET `/attributes` `[Public]`
Get all product attributes (Size, Color, Material, etc.) with sorted options. Used for building storefront search and filter UIs.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "a11e8400-e29b-41d4-a716-446655440000",
        "name": "Color",
        "code": "color",
        "inputType": "swatch",
        "options": [
          {
            "id": "o11e8400-e29b-41d4-a716-446655440000",
            "label": "Red",
            "value": "red",
            "colorHex": "#FF0000",
            "sortOrder": 0
          }
        ]
      }
    ]
  }
  ```

---

### GET `/attributes/code/:code` `[Public]`
Get single attribute definition and options by code name (e.g., `color`, `size`).
- **Path Parameter**: `code`

---

### GET `/attributes/category/:categoryId` `[Public]`
Get attributes mapped to a specific category, including flags `isRequired` and `isVariantAttribute`.
- **Path Parameter**: `categoryId`

---

## 6. Shopping Cart `/cart`

### GET `/cart` `🔒 Protected`
Get current user's shopping cart contents with live line totals and subtotal.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "cart-uuid",
      "items": [
        {
          "id": "cart-item-uuid",
          "variantId": "v11e8400-e29b-41d4-a716-446655440001",
          "variantName": "Red - L",
          "sku": "SAREE-RED-L",
          "quantity": 2,
          "priceSnapshot": "1299.00",
          "lineTotal": "2598.00",
          "imageUrl": "https://res.cloudinary.com/demo/image/upload/saree-red.jpg"
        }
      ],
      "itemCount": 2,
      "subtotal": "2598.00"
    }
  }
  ```

---

### POST `/cart/items` `🔒 Protected`
Add an item to the shopping cart. Automatically merges quantity if the variant is already in cart (max 99 per item).
- **Request Body**:
  ```json
  {
    "variantId": "v11e8400-e29b-41d4-a716-446655440001",
    "quantity": 1
  }
  ```
- **Response (201 Created)**: Returns added/updated cart item.
- **Error Codes**: `400 PRODUCT_UNAVAILABLE`, `400 INSUFFICIENT_STOCK`, `404 Variant NOT_FOUND`

---

### PATCH `/cart/items/:itemId` `🔒 Protected`
Update the quantity of a specific item in the cart.
- **Path Parameter**: `itemId` (Cart item UUID)
- **Request Body**:
  ```json
  {
    "quantity": 3
  }
  ```
- **Response (200 OK)**: Returns updated cart item.
- **Error Codes**: `400 INSUFFICIENT_STOCK`, `404 Item NOT_FOUND`

---

### DELETE `/cart/items/:itemId` `🔒 Protected`
Remove an item from the cart.
- **Path Parameter**: `itemId` (Cart item UUID)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": { "message": "Item removed" }
  }
  ```

---

### DELETE `/cart` `🔒 Protected`
Clear all items from the shopping cart.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": { "message": "Cart cleared" }
  }
  ```

---

## 7. Wishlist `/wishlist`

### GET `/wishlist` `🔒 Protected`
Get current user's wishlist with summary of saved products.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "wishlist-uuid",
      "items": [
        {
          "productId": "b11e8400-e29b-41d4-a716-446655440000",
          "product": {
            "id": "b11e8400-e29b-41d4-a716-446655440000",
            "name": "Nepali Silk Saree - Red",
            "slug": "nepali-silk-saree-red",
            "shortDescription": "Handcrafted silk saree",
            "status": "active",
            "avgRating": "4.50",
            "totalSold": 120,
            "isFeatured": true,
            "isTrending": true,
            "media": [{ "url": "https://res.cloudinary.com/saree.jpg" }],
            "variants": [{ "price": "1299.00" }]
          }
        }
      ]
    }
  }
  ```

---

### POST `/wishlist/:productId` `🔒 Protected`
Add a product to wishlist (idempotent).
- **Path Parameter**: `productId` (Product UUID)
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "added": true,
      "productId": "b11e8400-e29b-41d4-a716-446655440000"
    }
  }
  ```

---

### DELETE `/wishlist/:productId` `🔒 Protected`
Remove a product from wishlist (idempotent).
- **Path Parameter**: `productId` (Product UUID)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "removed": true,
      "productId": "b11e8400-e29b-41d4-a716-446655440000"
    }
  }
  ```

---

## 8. Orders & Checkout `/orders`

### POST `/orders` `🔒 Protected`
Place an order from items currently in the user's cart.  
Executed as an **atomic database transaction**:
1. Checks delivery serviceability.
2. Validates stock availability with row-level locks (prevents overselling).
3. Deducts variant inventory and creates transaction logs.
4. Applies coupon discount (if code provided).
5. Clears shopping cart.
6. Triggers SMS order confirmation (async).

- **Request Body**:
  ```json
  {
    "addressId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "paymentMethod": "cod",
    "couponCode": "SAVE10",
    "customerNotes": "Please deliver before 5 PM"
  }
  ```
  *(Supported payment methods: `"cod"`, `"esewa"`, `"fonepay"`. COD is disabled for remote delivery zones).*
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "order": {
        "id": "o88e8400-e29b-41d4-a716-446655440000",
        "orderNumber": "MW-2026-847291",
        "status": "pending",
        "paymentMethod": "cod",
        "paymentStatus": "pending",
        "subtotalAmount": "2598.00",
        "deliveryCharge": "100.00",
        "discountAmount": "259.80",
        "totalAmount": "2438.20",
        "deliveryAddress": {
          "fullName": "Sita Rai",
          "phone": "+9779841234567",
          "addressLine": "Thamel, House 23",
          "city": "Kathmandu",
          "district": "Bagmati",
          "zone": "inside_valley"
        },
        "items": [
          {
            "id": "oi-111",
            "productNameSnap": "Nepali Silk Saree - Red",
            "variantNameSnap": "Red - L",
            "skuSnap": "SAREE-RED-L",
            "priceSnap": "1299.00",
            "quantity": 2,
            "totalPrice": "2598.00"
          }
        ],
        "statusHistory": [
          {
            "toStatus": "pending",
            "note": "Order placed",
            "changedAt": "2026-07-21T12:00:00.000Z"
          }
        ],
        "createdAt": "2026-07-21T12:00:00.000Z"
      },
      "stalePriceWarnings": []
    }
  }
  ```
- **Error Codes**: `400 EMPTY_CART`, `400 ITEMS_UNAVAILABLE`, `400 DELIVERY_UNSERVICEABLE`, `400 COD_NOT_AVAILABLE`, `400 INSUFFICIENT_STOCK`, `400 COUPON_EXPIRED`, `404 Address NOT_FOUND`

---

### GET `/orders` `🔒 Protected`
List logged-in user's past orders with status filtering and pagination.
- **Query Parameters**:
  - `status` *(optional)*: Filter by `pending`, `confirmed`, `packed`, `shipped`, `delivered`, `cancelled`, `returned`
  - `page` *(optional, default 1)*: Page number
  - `limit` *(optional, default 20)*: Page size limit
- **Response (200 OK)**: Returns paginated list of Order objects.

---

### GET `/orders/:id` `🔒 Protected`
Get order details with item snapshots and full status tracking history.
- **Path Parameter**: `id` (Order UUID)
- **Response (200 OK)**: Returns full Order detail object.
- **Error Codes**: `404 Order NOT_FOUND`

---

## 9. Coupons `/coupons`

### POST `/coupons/validate` `🔒 Protected`
Validate a coupon code and calculate the discount preview for an order amount.
- **Request Body**:
  ```json
  {
    "code": "SAVE10",
    "orderAmount": 2598
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "code": "SAVE10",
      "discountType": "percentage",
      "discountValue": "10.00",
      "discountAmount": 259.8,
      "finalAmount": 2338.2
    }
  }
  ```
- **Error Codes**: `400 COUPON_NOT_FOUND`, `400 COUPON_NOT_STARTED`, `400 COUPON_EXPIRED`, `400 COUPON_EXHAUSTED`, `400 MIN_ORDER_REQUIRED`, `400 COUPON_ALREADY_USED`

---

## 10. Product Reviews `/reviews`

### GET `/reviews/product/:productId` `[Public]`
Get all approved customer reviews for a specific product.
- **Path Parameter**: `productId` (Product UUID)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "r11e8400-e29b-41d4-a716-446655440000",
        "rating": 5,
        "comment": "Beautiful saree! High quality fabric and fast shipping.",
        "status": "approved",
        "user": {
          "fullName": "Sita Rai",
          "avatarUrl": null
        },
        "createdAt": "2026-07-21T12:00:00.000Z"
      }
    ]
  }
  ```

---

### POST `/reviews/product/:productId` `🔒 Protected`
Submit a product review. Requires a delivered order containing the product (1 review per user per product).
- **Path Parameter**: `productId` (Product UUID)
- **Request Body**:
  ```json
  {
    "orderId": "o88e8400-e29b-41d4-a716-446655440000",
    "rating": 5,
    "comment": "Beautiful saree! High quality fabric and fast shipping."
  }
  ```
- **Response (201 Created)**: Returns review object (submitted for moderation).
- **Error Codes**: `400 ORDER_NOT_DELIVERED`, `400 PRODUCT_NOT_IN_ORDER`, `400 REVIEW_EXISTS`, `404 Product NOT_FOUND`

---

## 11. Delivery & Serviceability `/delivery`

### GET `/delivery/zones` `[Public]`
List all active delivery coverage zones.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "z11e8400-e29b-41d4-a716-446655440000",
        "code": "KTM",
        "name": "Kathmandu Valley",
        "type": "inside_valley"
      }
    ]
  }
  ```

---

### POST `/delivery/check` `[Public]`
Check if delivery is available to a destination pincode and estimate shipping charges and transit times.
- **Request Body**:
  ```json
  {
    "destPincode": "44600",
    "shopId": "s11e8400-e29b-41d4-a716-446655440000",
    "sizeClass": "SMALL"
  }
  ```
  *(Supported `sizeClass` values: `"SMALL"`, `"MEDIUM"`, `"LARGE"`, `"BULKY"`, `"HEAVY_BULKY"`, `"FRAGILE"`).*
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "result": "serviceable",
      "buyerMessage": "Delivery in 1-2 business days",
      "availableCarriers": [
        {
          "name": "Pathao Courier",
          "code": "PATHAO",
          "minDays": 1,
          "maxDays": 2,
          "costNpr": 100,
          "supportsCod": true
        }
      ],
      "minDeliveryCostNpr": "100",
      "fastestDeliveryDays": 1,
      "fromCache": false
    }
  }
  ```

---

## 12. Promotional Banners `/banners`

### GET `/banners` `[Public]`
Get active promotional banners within the current time window.
- **Query Parameters**:
  - `position` *(optional)*: `hero`, `category`, `promo`
  - `shopId` *(optional)*: Filter by shop
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "b11e8400-e29b-41d4-a716-446655440000",
        "title": "Dashain Special Discount",
        "subtitle": "Up to 30% off on traditional sarees",
        "imageUrl": "https://res.cloudinary.com/demo/banner.jpg",
        "linkUrl": "/products?isFeatured=true",
        "position": "hero",
        "sortOrder": 0,
        "isActive": true
      }
    ]
  }
  ```

---

## 13. Shops `/shops`

### GET `/shops/:slug` `[Public]`
Get public shop profile page by slug.
- **Path Parameter**: `slug` (e.g. `sita-fashion-house`)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "s11e8400-e29b-41d4-a716-446655440000",
      "name": "Sita Fashion House",
      "slug": "sita-fashion-house",
      "description": "Authentic Nepali clothing and accessories",
      "status": "active",
      "logoUrl": "https://res.cloudinary.com/demo/shop-logo.jpg",
      "businessAddress": "Thamel, Kathmandu",
      "businessPhone": "+9779841234567",
      "avgRating": "4.50",
      "totalReviews": 25,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  }
  ```
- **Error Codes**: `404 Shop NOT_FOUND`

---

### POST `/shops` `🔒 Protected`
Register a new shop on the platform (becomes shop owner, starts Starter trial).
- **Request Body**:
  ```json
  {
    "name": "Sita Fashion House",
    "slug": "sita-fashion-house",
    "description": "Authentic Nepali clothing",
    "businessAddress": "Thamel, Kathmandu",
    "businessPhone": "+9779841234567",
    "panNumber": "123456789"
  }
  ```
- **Response (201 Created)**: Returns created shop object.
- **Error Codes**: `400 PHONE_NOT_VERIFIED`, `409 SHOP_ALREADY_EXISTS`, `409 SLUG_TAKEN`

---

## 14. Notifications `/notifications`

### GET `/notifications` `🔒 Protected`
Get the 50 most recent notifications for the logged-in user (newest first).
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "n11e8400-e29b-41d4-a716-446655440000",
        "type": "order_status",
        "message": "Your order MW-2026-847291 has been shipped!",
        "isRead": false,
        "sentAt": "2026-07-21T12:00:00.000Z"
      }
    ]
  }
  ```

---

### PATCH `/notifications/:id/read` `🔒 Protected`
Mark a specific notification as read.
- **Path Parameter**: `id` (Notification UUID)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": { "message": "Notification marked as read" }
  }
  ```

---

### PATCH `/notifications/read-all` `🔒 Protected`
Mark all unread notifications for the user as read.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": { "message": "All notifications marked as read" }
  }
  ```

---

## 15. Navigation & User Menu `/navigation`

### GET `/navigation` `🔒 Protected`
Get role-based navigation links, user permissions, plan features, and unread/pending badge counts.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "role": "customer",
      "shopId": null,
      "permissions": {
        "canViewDashboard": false,
        "canCreateProduct": false,
        "canEditProduct": false,
        "canDeleteProduct": false,
        "canManageInventory": false,
        "canViewOrders": true,
        "canUpdateOrderStatus": false,
        "canManageCoupons": false,
        "canViewAnalytics": false,
        "canManageBanners": false,
        "canManageStaff": false,
        "canManageSettings": false
      },
      "planFeatures": {
        "canUseAnalytics": false,
        "canUseDiscounts": true,
        "canUseEsewa": false,
        "canUseBulkImport": false,
        "canUseSeoTools": false
      },
      "menu": [
        {
          "id": "orders",
          "label": "My Orders",
          "icon": "ShoppingBag",
          "path": "/orders"
        }
      ],
      "badges": {
        "pendingOrders": 0,
        "unreadNotifications": 2
      }
    }
  }
  ```

---

*Note: Merchant management endpoints (`/cms/*`, `/inventory/*`) and Super Admin endpoints (`/admin/*`) require seller or admin privileges and are documented separately.*
