# 06 — Development Guide

## Adding a New Module

```bash
# 1. Create directories
mkdir -p src/modules/mymodule/{dto,__tests__}

# 2. Create files
touch src/modules/mymodule/mymodule.service.ts
touch src/modules/mymodule/mymodule.controller.ts
touch src/modules/mymodule/mymodule.module.ts
touch src/modules/mymodule/dto/mymodule.dto.ts
touch src/modules/mymodule/__tests__/mymodule.service.spec.ts

# 3. Register in app.module.ts
# Add to imports: [..., MyModule]
```

## Code Conventions

- **No `any`**: TypeScript strict mode is enforced. Use `unknown` + type guards.
- **Error codes**: Always throw with `{ code: 'SCREAMING_SNAKE', message: '...' }`.
- **Async SMS/views**: Use `void promise.catch(() => {})` — never `await` non-critical async work.
- **Drizzle transactions**: Use `db.transaction(async (tx) => {...})` for multi-table writes.
- **Plan limits**: Always call `PlanGateService.assertLimit()` BEFORE any INSERT.
- **Resource counters**: Always call `incrementUsage()`/`decrementUsage()` AFTER successful writes.

## Environment Setup

```bash
# Install dependencies
npm install

# Database
docker compose up postgres -d
npm run db:push   # push schema (dev)
npm run db:seed   # seed reference data

# Dev server with hot reload
npm run start:dev

# Tests in watch mode
npm run test:watch
```

# 07 — Schema Decisions

## Why `shop_resource_usage`?

**Problem**: Checking `SELECT COUNT(*) FROM products WHERE shop_id = $1` on every product creation is O(n) and degrades as a shop grows.  
**Solution**: A denormalised counter table updated atomically with every INSERT/DELETE. Plan limit check is O(1): `SELECT total_products FROM shop_resource_usage WHERE shop_id = $1`.

## Why `planFeaturesSnapshot`?

When a shop subscribes to a plan, we copy the plan's feature flags into `planFeaturesSnapshot`. This means: if we later change the plan's limits (e.g., bump Starter from 50 → 100 products), **existing subscribers are unaffected** until they explicitly upgrade. This models real SaaS billing correctly.

## Why ltree for Categories?

PostgreSQL's `ltree` extension provides a native path type with GiST indexing. The `<@` operator ("is ancestor of") lets us find all descendants of a category in O(log n) without recursive CTEs. This is critical for category-filtered product browsing.

## Why Append-Only for `inventory_transactions` and `order_status_history`?

These tables are audit logs — they should never be modified or deleted. Every stock change and every order status transition creates a new row. This gives a complete, tamper-evident history for debugging, disputes, and analytics.

## Why GENERATED COLUMN for `quantityAvailable`?

```sql
quantity_available GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved)
```

PostgreSQL maintains this automatically. It's impossible for `quantityAvailable` to be stale or inconsistent — the database guarantees it. This eliminates an entire class of subtle bugs.

## Why Cookie-Based JWT (not localStorage)?

- `httpOnly: true` → XSS attacks cannot steal the token via JavaScript.
- `sameSite: strict` → CSRF attacks cannot trigger authenticated requests from other sites.
- `path` scoping on refresh token → it's never sent on regular API calls, only on the refresh endpoint.

These properties cannot be achieved with `localStorage` or `sessionStorage`.
