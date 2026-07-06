# 03 — Database Design

## All 42 Tables

### Auth Group
| Table | Key Design Decision |
|-------|-------------------|
| `users` | `phone` is the primary login identifier (unique). `email` is citext (case-insensitive). |
| `otp_tokens` | `codeHash` is argon2id — never plaintext. 5min expiry, max 3 attempts. |
| `refresh_tokens` | `tokenHash` = sha256(raw). `familyId` groups related rotations for theft detection. |
| `addresses` | Delivery zones pre-computed on address (`inside_valley/outside_valley/remote`). |

### Plans & Shops Group
| Table | Key Design Decision |
|-------|-------------------|
| `plans` | All limits stored as integers; `-1` means unlimited (never query DB for unlimited plans). |
| `shops` | `ownerUserId` is UNIQUE — enforces one shop per user at the database level. |
| `shop_subscriptions` | `planFeaturesSnapshot` is a JSONB copy of plan at subscription time — plan changes don't break existing subs. Partial unique index on `(shopId) WHERE status='active'`. |
| `shop_resource_usage` | O(1) plan limit checks — no COUNT(*) queries. Incremented/decremented in service layer. |

### Categories Group
| Table | Key Design Decision |
|-------|-------------------|
| `categories` | `path` is PostgreSQL `ltree` type. `path <@ 'women'` returns ALL descendants in O(log n). GiST index on path. |

### Attributes Group
| Table | Key Design Decision |
|-------|-------------------|
| `attributes` | Completely dynamic — no code changes needed for new attributes. |
| `category_attributes` | `isVariantAttribute=true` → builds the Color×Size matrix. `isVariantAttribute=false` → product metadata. |

### Products Group
| Table | Key Design Decision |
|-------|-------------------|
| `products` | Price is NOT on the product — it lives on variants. `searchVector` is `tsvector` with GIN index. |
| `product_variants` | `sku` has a GLOBAL unique constraint (across all shops). |
| `product_media` | First media auto-set as `isPrimary=true`. |

### Inventory Group
| Table | Key Design Decision |
|-------|-------------------|
| `inventory` | `quantityAvailable` is a GENERATED column (`on_hand - reserved`) — always consistent. |
| `inventory_transactions` | APPEND-ONLY audit log — never update or delete rows here. |

### Delivery Group
| Table | Key Design Decision |
|-------|-------------------|
| `pincode_zone_map` | `pincode` is PK — O(1) lookup for zone resolution. |
| `delivery_serviceability_cache` | Pre-computed results with 24h TTL. Unique index on `(originZoneId, destZoneId, sizeClass)`. |

### Commerce Group
| Table | Key Design Decision |
|-------|-------------------|
| `orders` | `shippingAddressSnap` is JSONB — address is frozen at order time, not FK. |
| `order_items` | All fields are snapshots (`productNameSnap`, `skuSnap`, etc.) — product/variant changes don't affect history. |
| `order_status_history` | APPEND-ONLY — every status transition recorded with who changed it and when. |
| `reviews` | `orderId` is UNIQUE — enforces one review per delivered order at DB level. |
| `notifications` | Partial index on `(userId, isRead) WHERE is_read = FALSE` — fast unread count. |
| `coupon_usages` | Per-user usage tracked here; `usageLimitPerUser` enforced in service layer. |

## Key Index Decisions

```sql
-- Full-text search on products
CREATE INDEX ON products USING GIN (search_vector);

-- Category subtree (ltree)  
CREATE INDEX ON categories USING GIST (path);

-- Unread notifications (partial index — small, fast)
CREATE INDEX ON notifications (user_id, is_read) WHERE is_read = FALSE;

-- Active shop subscription (partial unique — enforces one active sub)
CREATE UNIQUE INDEX ON shop_subscriptions (shop_id) WHERE status = 'active';

-- Inventory availability
CREATE INDEX ON inventory (quantity_available, low_stock_threshold);

-- O(1) pincode lookup
-- (pincode is already PK, so this is the PK index)

-- Delivery cache
CREATE UNIQUE INDEX ON delivery_serviceability_cache (origin_zone_id, dest_zone_id, size_class);
```

## Generated Column: quantityAvailable

```sql
quantity_available integer GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved)
```

This eliminates a class of bugs where `quantityAvailable` could become inconsistent with `quantityOnHand - quantityReserved`. PostgreSQL guarantees it.

## Why ltree for Categories?

Standard adjacency list: finding all descendants requires recursive CTEs — O(n) scans.  
ltree: `WHERE path <@ 'women'` uses the GiST index — O(log n) — returns all subcategories instantly.

```sql
-- All products in "Women" and all subcategories
SELECT p.* FROM products p
JOIN categories c ON c.id = p.category_id  
WHERE c.path <@ 'women' AND p.status = 'active';
```
