# 01 — Project Overview

## What Is Mayalu Wears?

Mayalu Wears is a Nepal-first fashion e-commerce platform built to support multi-vendor sellers offering clothing, jewellery, and electronics. It starts as a single-brand store and expands into a full marketplace in Phase 3.

## Architecture at a Glance

```
Browser / Mobile App
        │
        ▼
    NGINX (SSL termination, reverse proxy)
        │
        ▼
  NestJS 10 API  (this repo)
  ├── Cookie-based JWT auth (HttpOnly, SameSite=Strict)
  ├── Drizzle ORM → PostgreSQL 16
  ├── Cloudinary (media storage)
  ├── Sparrow SMS (Nepal OTP delivery)
  └── Global rate limiting (ThrottlerModule)
        │
        ▼
  PostgreSQL 16
  ├── uuid-ossp  (UUID primary keys)
  ├── citext     (case-insensitive email)
  ├── ltree      (category hierarchy)
  ├── pgcrypto   (additional crypto)
  └── pg_trgm    (trigram search)
```

## Module Map

| Module | Purpose |
|--------|---------|
| **Auth** | Phone OTP login, JWT rotation, theft detection |
| **Shops** | Multi-vendor registration, plan subscriptions |
| **Categories** | ltree-backed unlimited-depth hierarchy |
| **Attributes** | Dynamic per-category attributes (Color, Size, Fabric) |
| **Products** | Full product lifecycle: draft → active → archived |
| **Inventory** | Per-warehouse stock with append-only audit log |
| **Delivery** | Zone-based routing with 24h serviceability cache |
| **Cart** | Session cart with stock validation |
| **Wishlist** | User wishlist |
| **Orders** | Atomic order placement (stock + coupon + SMS) |
| **Coupons** | Percentage/fixed with per-user limits |
| **Reviews** | Verified purchase reviews (one per delivered order) |
| **Banners** | Date-ranged platform/shop banners |
| **Notifications** | In-app notifications with unread partial index |
| **Users** | Profile + address management |
| **Admin** | Order management, shop verification, moderation |

## Request Lifecycle

```
Request → NGINX → NestJS
  → ThrottlerGuard (rate limit)
  → AuthGuard (JWT from cookie/header)
  → ValidationPipe (class-validator DTOs)
  → Controller → Service → Drizzle → PostgreSQL
  → ResponseInterceptor (wrap in { success: true, data })
  → Response

Error path:
  → HttpExceptionFilter (standardised error envelope)
  → { success: false, error: { code, message }, path, timestamp }
```

## Phase Roadmap

| Phase | Features |
|-------|---------|
| **Phase 1** (now) | Auth, multi-vendor shops, products, orders, inventory, delivery |
| **Phase 2** | Analytics dashboard, bulk import, eSewa/Fonepay integration |
| **Phase 3** | Full marketplace (split orders per vendor, commission tracking) |
