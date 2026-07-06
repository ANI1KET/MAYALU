# Mayalu Wears — Backend API

> Nepal Fashion Commerce Platform · Multi-vendor Marketplace · NestJS 10 + PostgreSQL 16

[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org)
[![NestJS](https://img.shields.io/badge/NestJS-10-red)](https://nestjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)](https://postgresql.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://typescriptlang.org)

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — generate secrets with:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"  # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"  # ADMIN_SECRET_KEY

# 3. Start PostgreSQL (with all required extensions)
docker compose up postgres -d

# 4. Push schema and seed reference data
npm run db:push
npm run db:seed

# 5. Start development server
npm run start:dev
```

**API**: `http://localhost:3000/api/v1`  
**Swagger**: `http://localhost:3000/api/docs`  
**Adminer**: `http://localhost:8080`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | NestJS 10 + Express |
| Database | PostgreSQL 16 (ltree, citext, uuid-ossp, pg_trgm) |
| ORM | Drizzle ORM (type-safe, zero magic) |
| Auth | JWT (jose HS256) + argon2id OTP hashing |
| Media | Cloudinary (presigned direct uploads) |
| SMS | Sparrow SMS Nepal (mocked in dev) |
| Docs | @nestjs/swagger (OpenAPI 3) |
| Tests | Jest + ts-jest (13 suites) |
| Security | Helmet, CORS, ThrottlerModule, HttpOnly cookies |

---

## Project Structure

```
backend/
├── src/
│   ├── main.ts                    # Bootstrap with Swagger + security middleware
│   ├── app.module.ts              # Root module — all feature modules registered here
│   ├── config/app.config.ts       # Zod env validation — fails fast on startup
│   ├── database/
│   │   ├── schema/index.ts        # ALL 42 table definitions (Drizzle ORM)
│   │   ├── database.module.ts     # Global Drizzle provider (token: 'DATABASE')
│   │   └── seed/index.ts          # Plans, categories, attributes, delivery zones
│   ├── common/
│   │   ├── services/              # JWT, Token, SMS, Media, PlanGate
│   │   ├── guards/                # AuthGuard (JWT cookie), AdminGuard (X-Admin-Key)
│   │   ├── filters/               # HttpExceptionFilter → standardised error JSON
│   │   ├── interceptors/          # ResponseInterceptor → { success, data } wrapper
│   │   ├── decorators/            # @CurrentUser, @Public, @SkipCsrf
│   │   └── utils/                 # hash, slug, pagination utilities
│   └── modules/
│       ├── auth/                  # OTP flow, JWT rotation, theft detection
│       ├── shops/                 # Multi-vendor shop registration + subscriptions
│       ├── categories/            # ltree-backed infinite depth hierarchy
│       ├── attributes/            # Dynamic per-category attributes (Color×Size matrix)
│       ├── products/              # Full lifecycle: draft → active → archived
│       ├── inventory/             # Per-warehouse stock + append-only audit log
│       ├── delivery/              # Zone routing + 24h serviceability cache
│       ├── cart/                  # Stock-validated cart with guest support
│       ├── wishlist/              # User wishlist
│       ├── orders/                # Atomic order placement (TX: stock+coupon+SMS)
│       ├── coupons/               # Percentage/fixed coupons with per-user limits
│       ├── reviews/               # Verified purchase reviews (1 per delivered order)
│       ├── banners/               # Date-ranged platform/shop banners
│       ├── notifications/         # In-app notifications with unread index
│       ├── users/                 # Profile + address management
│       └── admin/                 # Order management, shop verification, moderation
├── docs/
│   ├── API.md                     # Complete endpoint reference
│   ├── DEPLOYMENT.md              # VPS + NGINX + SSL guide
│   ├── TESTING.md                 # Test philosophy and patterns
│   └── context/                   # Architecture decision records (7 docs)
├── docker-compose.yml
├── Dockerfile                     # Multi-stage: dev → builder → production
├── drizzle.config.ts
└── jest.config.ts
```

---

## Available Scripts

```bash
npm run start:dev     # Development with hot reload
npm run start:prod    # Production (requires npm run build first)
npm run build         # Compile TypeScript

npm test              # Run all 13 test suites
npm run test:watch    # TDD mode
npm run test:cov      # Coverage report → coverage/index.html

npm run db:push       # Push schema to DB (dev — no migration files)
npm run db:migrate    # Apply SQL migrations (production)
npm run db:generate   # Generate migration files from schema changes
npm run db:seed       # Seed plans, categories, attributes, delivery zones
npm run db:studio     # Drizzle Studio visual browser → http://localhost:4983
```

---

## Database Schema Highlights

- **42 tables** covering auth, commerce, inventory, delivery, analytics
- **ltree** for O(log n) category subtree queries
- **tsvector + GIN** for full-text product search
- **GENERATED COLUMN** for `quantityAvailable = onHand - reserved` (always consistent)
- **Partial indexes** for active subscriptions and unread notifications
- **Append-only** inventory transactions and order status history
- **JSONB snapshots** on orders (address, product details frozen at purchase time)

---

## Security Features

- **HttpOnly + SameSite=Strict cookies** — XSS and CSRF protection
- **Path-scoped refresh token** — only sent to `/api/v1/auth/refresh`
- **Refresh token family rotation** with reuse detection
- **argon2id OTP hashing** (memoryCost: 4096, timeCost: 1)
- **Helmet** CSP + HSTS headers
- **ThrottlerModule** — 100 req/min global, 5 req/min auth endpoints
- **Zod env validation** — crashes fast with clear errors on misconfiguration
- **TypeScript strict mode** — zero `any` in production code

---

## Documentation

| Document | Contents |
|----------|---------|
| `docs/API.md` | Every endpoint: method, path, request, response, error codes |
| `docs/DEPLOYMENT.md` | Docker, VPS, NGINX reverse proxy, SSL, env vars |
| `docs/TESTING.md` | Test philosophy, mock patterns, adding new tests |
| `docs/context/01-overview.md` | Architecture overview and module map |
| `docs/context/02-auth-flow.md` | OTP → JWT → cookies, token rotation diagrams |
| `docs/context/03-database-design.md` | All 42 tables and key index decisions |
| `docs/context/04-delivery-payment.md` | Zones, carriers, COD/eSewa/Fonepay |
| `docs/context/05-admin-operations.md` | Daily ops: orders, stock, coupons |
| `docs/context/06-development-guide.md` | Setup, conventions, adding modules, schema decisions |
