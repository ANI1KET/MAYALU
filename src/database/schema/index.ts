import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  smallint,
  numeric,
  jsonb,
  char,
  bigserial,
  customType,
  index,
  uniqueIndex,
  primaryKey,
  pgEnum,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ─── Custom PostgreSQL Types ─────────────────────────────────────

export const ltree = customType<{ data: string }>({
  dataType() {
    return 'ltree';
  },
});

export const citext = customType<{ data: string }>({
  dataType() {
    return 'citext';
  },
});

export const inetType = customType<{ data: string }>({
  dataType() {
    return 'inet';
  },
});

export const tsvectorType = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

// ─── Enums ───────────────────────────────────────────────────────

export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'pending', 'deleted']);
export const otpPurposeEnum = pgEnum('otp_purpose', ['login', 'register', 'reset_phone']);
export const billingCycleEnum = pgEnum('billing_cycle', ['monthly', 'yearly', 'lifetime']);
export const planStatusEnum = pgEnum('plan_status', ['active', 'deprecated', 'hidden']);
export const shopStatusEnum = pgEnum('shop_status', ['pending', 'active', 'suspended', 'closed']);
export const shopVerificationStatusEnum = pgEnum('shop_verification_status', [
  'unverified', 'in_review', 'verified', 'rejected',
]);
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trialing', 'active', 'past_due', 'cancelled', 'expired',
]);
export const shopMemberRoleEnum = pgEnum('shop_member_role', [
  'owner', 'manager', 'inventory', 'support', 'analyst',
]);
export const addressTypeEnum = pgEnum('address_type', ['home', 'work', 'other']);
export const deliveryZoneEnum = pgEnum('delivery_zone', ['inside_valley', 'outside_valley', 'remote']);
export const inputTypeEnum = pgEnum('input_type', [
  'text', 'number', 'boolean', 'select', 'multi_select', 'color', 'size',
]);
export const productStatusEnum = pgEnum('product_status', ['draft', 'active', 'inactive', 'archived']);
export const mediaTypeEnum = pgEnum('media_type', ['image', 'gif', 'video']);
export const inventoryTxTypeEnum = pgEnum('inventory_tx_type', [
  'restock', 'sale', 'return', 'adjustment', 'damage', 'opening',
]);
export const bannerPositionEnum = pgEnum('banner_position', ['hero', 'category', 'promo']);
export const discountTypeEnum = pgEnum('discount_type', ['percentage', 'fixed']);
export const orderStatusEnum = pgEnum('order_status', [
  'pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded',
]);
export const paymentMethodEnum = pgEnum('payment_method', ['cod', 'esewa', 'fonepay']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'paid', 'failed', 'refunded']);
export const reviewStatusEnum = pgEnum('review_status', ['pending', 'approved', 'rejected']);
export const notificationTypeEnum = pgEnum('notification_type', [
  'order_update', 'promo', 'cart_reminder', 'general',
]);
export const serviceabilityEnum = pgEnum('serviceability_result', [
  'serviceable', 'unserviceable', 'enquiry_required',
]);
export const sizeClassEnum = pgEnum('size_class', [
  'SMALL', 'MEDIUM', 'LARGE', 'BULKY', 'HEAVY_BULKY', 'FRAGILE',
]);

// ─── Tables ──────────────────────────────────────────────────────

// ─── AUTH ─────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: text('phone').unique().notNull(),
    email: citext('email').unique(),
    fullName: text('full_name'),
    avatarUrl: text('avatar_url'),
    avatarPublicId: text('avatar_public_id'),
    status: userStatusEnum('status').default('pending').notNull(),
    isPhoneVerified: boolean('is_phone_verified').default(false).notNull(),
    isEmailVerified: boolean('is_email_verified').default(false).notNull(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    phoneIdx: index('users_phone_idx').on(t.phone),
    statusIdx: index('users_status_idx').on(t.status),
    emailIdx: index('users_email_idx').on(t.email),
  }),
);

export const otpTokens = pgTable(
  'otp_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: text('phone').notNull(),
    codeHash: text('code_hash').notNull(),
    purpose: otpPurposeEnum('purpose').notNull(),
    attempts: smallint('attempts').default(0).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    ipAddress: inetType('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    phonePurposeIdx: index('otp_phone_purpose_idx').on(t.phone, t.purpose),
    expiresAtIdx: index('otp_expires_at_idx').on(t.expiresAt),
  }),
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    familyId: uuid('family_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').unique().notNull(),
    isUsed: boolean('is_used').default(false).notNull(),
    replacedById: uuid('replaced_by_id'),
    deviceInfo: jsonb('device_info').default({}).notNull(),
    ipAddress: inetType('ip_address'),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdIdx: index('rt_user_id_idx').on(t.userId),
    familyIdIdx: index('rt_family_id_idx').on(t.familyId),
    expiresAtIdx: index('rt_expires_at_idx').on(t.expiresAt),
  }),
);

export const addresses = pgTable('addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: addressTypeEnum('type').default('home').notNull(),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  addressLine: text('address_line').notNull(),
  landmark: text('landmark'),
  city: text('city').notNull(),
  district: text('district').notNull(),
  pincode: text('pincode'),
  zone: deliveryZoneEnum('zone').default('outside_valley').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index('addresses_user_id_idx').on(t.userId),
  zoneIdx: index('addresses_zone_idx').on(t.zone),
}));

// ─── PLANS & SHOPS ────────────────────────────────────────────────

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  description: text('description'),
  billingCycle: billingCycleEnum('billing_cycle').default('monthly').notNull(),
  price: numeric('price', { precision: 14, scale: 2 }).notNull(),
  currencyCode: char('currency_code', { length: 3 }).default('NPR').notNull(),
  status: planStatusEnum('status').default('active').notNull(),
  isPublic: boolean('is_public').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  maxProducts: integer('max_products').default(50).notNull(),
  maxVariantsPerProduct: smallint('max_variants_per_product').default(10).notNull(),
  maxImagesPerProduct: smallint('max_images_per_product').default(5).notNull(),
  maxWarehouses: smallint('max_warehouses').default(1).notNull(),
  maxStaffMembers: smallint('max_staff_members').default(1).notNull(),
  storageGb: numeric('storage_gb', { precision: 6, scale: 2 }).default('2').notNull(),
  canUseCod: boolean('can_use_cod').default(true).notNull(),
  canUseEsewa: boolean('can_use_esewa').default(false).notNull(),
  canUseDiscounts: boolean('can_use_discounts').default(false).notNull(),
  canUseAnalytics: boolean('can_use_analytics').default(false).notNull(),
  canUseCustomDomain: boolean('can_use_custom_domain').default(false).notNull(),
  canUseBulkImport: boolean('can_use_bulk_import').default(false).notNull(),
  canUseSeoTools: boolean('can_use_seo_tools').default(false).notNull(),
  canUseProductVideos: boolean('can_use_product_videos').default(false).notNull(),
  canManageReturns: boolean('can_manage_returns').default(false).notNull(),
  commissionRate: numeric('commission_rate', { precision: 5, scale: 2 }).default('0').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const shops = pgTable(
  'shops',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id')
      .unique()
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    slug: text('slug').unique().notNull(),
    description: text('description'),
    logoUrl: text('logo_url'),
    logoPublicId: text('logo_public_id'),
    bannerUrl: text('banner_url'),
    bannerPublicId: text('banner_public_id'),
    status: shopStatusEnum('status').default('pending').notNull(),
    verificationStatus: shopVerificationStatusEnum('verification_status')
      .default('unverified')
      .notNull(),
    businessAddress: text('business_address'),
    businessPhone: text('business_phone'),
    panNumber: text('pan_number'),
    avgRating: numeric('avg_rating', { precision: 3, scale: 2 }).default('0'),
    totalReviews: integer('total_reviews').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('shops_status_idx').on(t.status),
    slugIdx: index('shops_slug_idx').on(t.slug),
  }),
);

export const shopSubscriptions = pgTable(
  'shop_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id),
    status: subscriptionStatusEnum('status').default('trialing').notNull(),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
    planFeaturesSnapshot: jsonb('plan_features_snapshot').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    activeShopIdx: uniqueIndex('shop_subs_active_idx')
      .on(t.shopId)
      .where(sql`${t.status} = 'active'`),
  }),
);

export const shopMembers = pgTable(
  'shop_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: shopMemberRoleEnum('role').default('manager').notNull(),
    invitedByUserId: uuid('invited_by_user_id').references(() => users.id),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    permissionOverrides: jsonb('permission_overrides').default({}).notNull(),
  },
  (t) => ({
    shopUserIdx: uniqueIndex('shop_members_shop_user_idx').on(t.shopId, t.userId),
  }),
);

export const shopResourceUsage = pgTable('shop_resource_usage', {
  shopId: uuid('shop_id')
    .primaryKey()
    .references(() => shops.id, { onDelete: 'cascade' }),
  totalProducts: integer('total_products').default(0).notNull(),
  totalActiveProducts: integer('total_active_products').default(0).notNull(),
  totalVariants: integer('total_variants').default(0).notNull(),
  totalStaffMembers: integer('total_staff_members').default(0).notNull(),
  storageMbUsed: numeric('storage_mb_used', { precision: 10, scale: 2 }).default('0').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── CATEGORIES ────────────────────────────────────────────────────

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id),
    path: ltree('path').notNull(),
    name: text('name').notNull(),
    slug: text('slug').unique().notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    imagePublicId: text('image_public_id'),
    level: smallint('level').default(0).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    parentIdIdx: index('categories_parent_id_idx').on(t.parentId),
    // NOTE: GiST index on `path` (ltree) for fast subtree queries is created
    // via raw SQL post-push — see seedSpecialIndexes() in database/seed/index.ts.
    // Drizzle 0.30.x's IndexBuilder does not support .using('gist', ...).
  }),
);

// ─── ATTRIBUTES ────────────────────────────────────────────────────

export const attributes = pgTable('attributes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  code: text('code').unique().notNull(),
  inputType: inputTypeEnum('input_type').default('text').notNull(),
  unit: text('unit'),
  isFilterable: boolean('is_filterable').default(false).notNull(),
  isSearchable: boolean('is_searchable').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});

export const attributeOptions = pgTable(
  'attribute_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attributeId: uuid('attribute_id')
      .notNull()
      .references(() => attributes.id, { onDelete: 'cascade' }),
    value: text('value').notNull(),
    label: text('label').notNull(),
    colorHex: char('color_hex', { length: 7 }),
    sortOrder: integer('sort_order').default(0).notNull(),
  },
  (t) => ({
    // Composite unique index also serves attributeId-only lookups (leftmost-prefix),
    // so it replaces the old standalone attr_opts_attribute_id_idx.
    // Backs seedAttributes()'s .onConflictDoNothing() — without this, reseeding
    // silently doubled every option (no constraint for Postgres to conflict on).
    attributeValueIdx: uniqueIndex('attr_opts_attribute_value_idx').on(t.attributeId, t.value),
  }),
);

export const categoryAttributes = pgTable(
  'category_attributes',
  {
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    attributeId: uuid('attribute_id')
      .notNull()
      .references(() => attributes.id, { onDelete: 'cascade' }),
    isRequired: boolean('is_required').default(false).notNull(),
    isVariantAttribute: boolean('is_variant_attribute').default(false).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.categoryId, t.attributeId] }),
  }),
);

export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').unique().notNull(),
  slug: text('slug').unique().notNull(),
});

// ─── PRODUCTS ──────────────────────────────────────────────────────

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    shortDescription: text('short_description'),
    fabricInfo: text('fabric_info'),
    sizeChart: text('size_chart'),
    categoryId: uuid('category_id').references(() => categories.id),
    status: productStatusEnum('status').default('draft').notNull(),
    isFeatured: boolean('is_featured').default(false).notNull(),
    isTrending: boolean('is_trending').default(false).notNull(),
    isNewArrival: boolean('is_new_arrival').default(false).notNull(),
    totalSold: integer('total_sold').default(0).notNull(),
    avgRating: numeric('avg_rating', { precision: 3, scale: 2 }).default('0').notNull(),
    totalReviews: integer('total_reviews').default(0).notNull(),

    // ── Denormalized hot-path columns (eliminate subqueries on browse) ──
    // Updated by service layer on variant create/update/delete
    minPriceNpr: numeric('min_price_npr', { precision: 12, scale: 2 }),
    maxPriceNpr: numeric('max_price_npr', { precision: 12, scale: 2 }),
    // Updated by service layer on media add/remove (first media = primary)
    primaryImageUrl: text('primary_image_url'),
    // Count of active variants — avoids JOIN on listing
    activeVariantCount: integer('active_variant_count').default(0).notNull(),

    searchVector: tsvectorType('search_vector'),
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    shopStatusPublishedIdx: index('products_shop_status_published_idx').on(
      t.shopId, t.status, t.publishedAt,
    ),
    categoryIdx: index('products_category_idx').on(t.categoryId),
    featuredIdx: index('products_featured_idx').on(t.isFeatured),
    trendingIdx: index('products_trending_idx').on(t.isTrending),
    newArrivalIdx: index('products_new_arrival_idx').on(t.isNewArrival),
    totalSoldIdx: index('products_total_sold_idx').on(t.totalSold),
    // NOTE: GIN index on `search_vector` for full-text search is created
    // via raw SQL post-push — see seedSpecialIndexes() in database/seed/index.ts.
    // Drizzle 0.30.x's IndexBuilder does not support .using('gin', ...).
    shopSlugIdx: uniqueIndex('products_shop_slug_idx').on(t.shopId, t.slug),
  }),
);

export const productTags = pgTable(
  'product_tags',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.productId, t.tagId] }),
  }),
);

export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text('sku').unique().notNull(),
    name: text('name').notNull(),
    price: numeric('price', { precision: 12, scale: 2 }).notNull(),
    compareAtPrice: numeric('compare_at_price', { precision: 12, scale: 2 }),
    costPrice: numeric('cost_price', { precision: 12, scale: 2 }),
    currencyCode: char('currency_code', { length: 3 }).default('NPR').notNull(),
    weightGrams: integer('weight_grams'),
    lengthCm: numeric('length_cm', { precision: 8, scale: 2 }),
    widthCm: numeric('width_cm', { precision: 8, scale: 2 }),
    heightCm: numeric('height_cm', { precision: 8, scale: 2 }),
    isActive: boolean('is_active').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
  },
  (t) => ({
    productIdIdx: index('variants_product_id_idx').on(t.productId),
    productActiveIdx: index('variants_product_active_idx').on(t.productId, t.isActive),
  }),
);

export const variantAttributeValues = pgTable(
  'variant_attribute_values',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    attributeId: uuid('attribute_id')
      .notNull()
      .references(() => attributes.id),
    attributeOptionId: uuid('attribute_option_id').references(() => attributeOptions.id),
    customValue: text('custom_value'),
  },
  (t) => ({
    variantAttributeIdx: uniqueIndex('vav_variant_attribute_idx').on(t.variantId, t.attributeId),
  }),
);

export const productAttributeValues = pgTable(
  'product_attribute_values',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    attributeId: uuid('attribute_id')
      .notNull()
      .references(() => attributes.id),
    attributeOptionId: uuid('attribute_option_id').references(() => attributeOptions.id),
    customValue: text('custom_value'),
  },
  (t) => ({
    productAttributeIdx: uniqueIndex('pav_product_attribute_idx').on(t.productId, t.attributeId),
  }),
);

export const productMedia = pgTable(
  'product_media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
    url: text('url').notNull(),
    publicId: text('public_id').notNull(),
    type: mediaTypeEnum('type').default('image').notNull(),
    altText: text('alt_text'),
    isPrimary: boolean('is_primary').default(false).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    fileSizeBytes: integer('file_size_bytes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    productIdIdx: index('product_media_product_id_idx').on(t.productId),
  }),
);

// ─── INVENTORY ─────────────────────────────────────────────────────

export const warehouses = pgTable(
  'warehouses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    addressId: uuid('address_id').references(() => addresses.id),
    isActive: boolean('is_active').default(true).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    shopIdIdx: index('warehouses_shop_id_idx').on(t.shopId),
  }),
);

export const inventory = pgTable(
  'inventory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'cascade' }),
    quantityOnHand: integer('quantity_on_hand').default(0).notNull(),
    quantityReserved: integer('quantity_reserved').default(0).notNull(),
    // NOTE: "available" quantity is NOT a stored column — it's always computed
    // as (quantity_on_hand - quantity_reserved) at query time. This avoids
    // drizzle-orm 0.30.x's lack of .generatedAlwaysAs() support on integers,
    // and guarantees the value can never drift out of sync (single source
    // of truth = the two base columns, which are updated atomically together
    // in orders.service.ts).
    lowStockThreshold: integer('low_stock_threshold').default(5).notNull(),
    allowBackorder: boolean('allow_backorder').default(false).notNull(),
  },
  (t) => ({
    variantWarehouseIdx: uniqueIndex('inventory_variant_warehouse_idx').on(
      t.variantId, t.warehouseId,
    ),
    // Composite index supports the low-stock query's WHERE/JOIN columns.
    // The exact expression `(quantity_on_hand - quantity_reserved) <= low_stock_threshold`
    // is evaluated at query time — see getLowStock() in inventory.service.ts.
    lowStockIdx: index('inventory_low_stock_idx').on(
      t.warehouseId, t.quantityOnHand, t.quantityReserved, t.lowStockThreshold,
    ),
    onHandCheck: check('inventory_on_hand_check', sql`${t.quantityOnHand} >= 0`),
    reservedCheck: check('inventory_reserved_check', sql`${t.quantityReserved} >= 0`),
  }),
);

export const inventoryTransactions = pgTable(
  'inventory_transactions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    inventoryId: uuid('inventory_id')
      .notNull()
      .references(() => inventory.id),
    type: inventoryTxTypeEnum('type').notNull(),
    quantityDelta: integer('quantity_delta').notNull(),
    quantityAfter: integer('quantity_after').notNull(),
    referenceType: text('reference_type'),
    referenceId: uuid('reference_id'),
    notes: text('notes'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    inventoryIdIdx: index('inv_tx_inventory_id_idx').on(t.inventoryId),
    createdAtIdx: index('inv_tx_created_at_idx').on(t.createdAt),
  }),
);

// ─── DELIVERY ──────────────────────────────────────────────────────

export const deliveryZones = pgTable('delivery_zones', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  code: text('code').unique().notNull(),
  countryCode: char('country_code', { length: 2 }).default('NP').notNull(),
  cities: text('cities').array(),
  districts: text('districts').array(),
  pincodes: text('pincodes').array(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const pincodeZoneMap = pgTable(
  'pincode_zone_map',
  {
    pincode: text('pincode').primaryKey(),
    zoneId: uuid('zone_id')
      .notNull()
      .references(() => deliveryZones.id, { onDelete: 'cascade' }),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (t) => ({
    zoneIdIdx: index('pzm_zone_id_idx').on(t.zoneId),
  }),
);

export const carrierZoneRoutes = pgTable(
  'carrier_zone_routes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    carrierCode: text('carrier_code').notNull(),
    carrierName: text('carrier_name').notNull(),
    originZoneId: uuid('origin_zone_id')
      .notNull()
      .references(() => deliveryZones.id),
    destZoneId: uuid('dest_zone_id')
      .notNull()
      .references(() => deliveryZones.id),
    isActive: boolean('is_active').default(true).notNull(),
    minDays: smallint('min_days').notNull(),
    maxDays: smallint('max_days').notNull(),
    baseCostNpr: numeric('base_cost_npr', { precision: 10, scale: 2 }).notNull(),
    perKgCostNpr: numeric('per_kg_cost_npr', { precision: 10, scale: 2 }).default('0').notNull(),
    maxWeightGrams: integer('max_weight_grams'),
    supportsCod: boolean('supports_cod').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
  },
  (t) => ({
    carrierRouteIdx: uniqueIndex('czr_carrier_route_idx').on(
      t.carrierCode, t.originZoneId, t.destZoneId,
    ),
    routeActiveIdx: index('czr_route_active_idx').on(t.originZoneId, t.destZoneId, t.isActive),
  }),
);

export const deliveryServiceabilityCache = pgTable(
  'delivery_serviceability_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    originZoneId: uuid('origin_zone_id')
      .notNull()
      .references(() => deliveryZones.id),
    destZoneId: uuid('dest_zone_id')
      .notNull()
      .references(() => deliveryZones.id),
    sizeClass: sizeClassEnum('size_class').notNull(),
    result: serviceabilityEnum('result').notNull(),
    buyerMessage: text('buyer_message'),
    availableCarriersJson: jsonb('available_carriers_json').default([]).notNull(),
    minDeliveryCostNpr: numeric('min_delivery_cost_npr', { precision: 10, scale: 2 }),
    fastestDeliveryDays: smallint('fastest_delivery_days'),
    computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    cacheUniqueIdx: uniqueIndex('dsc_unique_idx').on(t.originZoneId, t.destZoneId, t.sizeClass),
    expiresAtIdx: index('dsc_expires_at_idx').on(t.expiresAt),
  }),
);

// ─── COMMERCE ──────────────────────────────────────────────────────

export const banners = pgTable(
  'banners',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shopId: uuid('shop_id').references(() => shops.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    imageUrl: text('image_url').notNull(),
    publicId: text('public_id').notNull(),
    linkUrl: text('link_url'),
    position: bannerPositionEnum('position').default('hero').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    positionActiveIdx: index('banners_position_active_idx').on(t.position, t.isActive),
  }),
);

export const carts = pgTable(
  'carts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    sessionId: text('session_id'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdIdx: index('carts_user_id_idx').on(t.userId),
    sessionIdIdx: index('carts_session_id_idx').on(t.sessionId),
  }),
);

export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id),
    quantity: smallint('quantity').notNull(),
    priceSnapshot: numeric('price_snapshot', { precision: 10, scale: 2 }).notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    cartVariantIdx: uniqueIndex('cart_items_cart_variant_idx').on(t.cartId, t.variantId),
    variantIdx: index('cart_items_variant_id_idx').on(t.variantId),
    qtyCheck: check('cart_items_qty_check', sql`${t.quantity} > 0`),
  }),
);

export const wishlists = pgTable('wishlists', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .unique()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const wishlistItems = pgTable(
  'wishlist_items',
  {
    wishlistId: uuid('wishlist_id')
      .notNull()
      .references(() => wishlists.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.wishlistId, t.productId] }),
    productIdIdx: index('wishlist_items_product_id_idx').on(t.productId),
  }),
);

export const coupons = pgTable(
  'coupons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shopId: uuid('shop_id').references(() => shops.id, { onDelete: 'cascade' }),
    code: text('code').unique().notNull(),
    description: text('description'),
    discountType: discountTypeEnum('discount_type').notNull(),
    discountValue: numeric('discount_value', { precision: 10, scale: 2 }).notNull(),
    minOrderAmount: numeric('min_order_amount', { precision: 10, scale: 2 }),
    maxDiscount: numeric('max_discount', { precision: 10, scale: 2 }),
    usageLimitTotal: integer('usage_limit_total'),
    usageLimitPerUser: smallint('usage_limit_per_user').default(1).notNull(),
    usageCount: integer('usage_count').default(0).notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    codeIdx: index('coupons_code_idx').on(t.code),
    activeIdx: index('coupons_active_idx').on(t.isActive),
    shopIdIdx: index('coupons_shop_id_idx').on(t.shopId),
  }),
);

export const couponUsages = pgTable(
  'coupon_usages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    couponId: uuid('coupon_id')
      .notNull()
      .references(() => coupons.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    orderId: uuid('order_id'),
    amountSaved: numeric('amount_saved', { precision: 10, scale: 2 }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    couponUserIdx: index('coupon_usages_coupon_user_idx').on(t.couponId, t.userId),
  }),
);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderNumber: text('order_number').unique().notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    status: orderStatusEnum('status').default('pending').notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    paymentStatus: paymentStatusEnum('payment_status').default('pending').notNull(),
    paymentReference: text('payment_reference'),
    subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
    discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    deliveryCharge: numeric('delivery_charge', { precision: 10, scale: 2 }).default('0').notNull(),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
    couponId: uuid('coupon_id').references(() => coupons.id),
    couponCode: text('coupon_code'),
    shippingAddressSnap: jsonb('shipping_address_snap').notNull(),
    customerNotes: text('customer_notes'),
    adminNotes: text('admin_notes'),
    estimatedDelivery: text('estimated_delivery').default('5-7 business days').notNull(),
    deliveryZone: deliveryZoneEnum('delivery_zone').default('outside_valley').notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    packedAt: timestamp('packed_at', { withTimezone: true }),
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdIdx: index('orders_user_id_idx').on(t.userId),
    statusIdx: index('orders_status_idx').on(t.status),
    paymentStatusIdx: index('orders_payment_status_idx').on(t.paymentStatus),
    paymentMethodIdx: index('orders_payment_method_idx').on(t.paymentMethod),
    createdAtIdx: index('orders_created_at_idx').on(t.createdAt),
    orderNumberIdx: uniqueIndex('orders_order_number_idx').on(t.orderNumber),
  }),
);

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    shopId: uuid('shop_id').references(() => shops.id),
    variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
    productNameSnap: text('product_name_snap').notNull(),
    variantNameSnap: text('variant_name_snap').notNull(),
    skuSnap: text('sku_snap').notNull(),
    imageUrlSnap: text('image_url_snap'),
    attributesSnap: jsonb('attributes_snap').default({}).notNull(),
    priceSnap: numeric('price_snap', { precision: 12, scale: 2 }).notNull(),
    quantity: smallint('quantity').notNull(),
    totalPrice: numeric('total_price', { precision: 12, scale: 2 }).notNull(),
  },
  (t) => ({
    orderIdIdx: index('order_items_order_id_idx').on(t.orderId),
    shopIdIdx: index('order_items_shop_id_idx').on(t.shopId),
    variantIdIdx: index('order_items_variant_id_idx').on(t.variantId),
    qtyCheck: check('order_items_qty_check', sql`${t.quantity} > 0`),
  }),
);

export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    fromStatus: orderStatusEnum('from_status'),
    toStatus: orderStatusEnum('to_status').notNull(),
    note: text('note'),
    changedByUserId: uuid('changed_by_user_id').references(() => users.id),
    changedAt: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orderIdIdx: index('osh_order_id_idx').on(t.orderId),
  }),
);

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    orderId: uuid('order_id')
      .unique()
      .notNull()
      .references(() => orders.id),
    rating: smallint('rating').notNull(),
    comment: text('comment'),
    isVerifiedPurchase: boolean('is_verified_purchase').default(true).notNull(),
    status: reviewStatusEnum('status').default('pending').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    productIdIdx: index('reviews_product_id_idx').on(t.productId),
    shopStatusIdx: index('reviews_shop_status_idx').on(t.shopId, t.status),
    ratingCheck: check('reviews_rating_check', sql`${t.rating} BETWEEN 1 AND 5`),
  }),
);

export const reviewMedia = pgTable('review_media', {
  id: uuid('id').primaryKey().defaultRandom(),
  reviewId: uuid('review_id')
    .notNull()
    .references(() => reviews.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  publicId: text('public_id').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
}, (t) => ({
  reviewIdIdx: index('review_media_review_id_idx').on(t.reviewId),
}));

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    dataJson: jsonb('data_json').default({}).notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (t) => ({
    unreadIdx: index('notifications_unread_idx')
      .on(t.userId, t.isRead)
      .where(sql`${t.isRead} = false`),
  }),
);

export const productViews = pgTable(
  'product_views',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
    shopId: uuid('shop_id').references(() => shops.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    sessionId: text('session_id'),
    source: text('source'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    shopProductIdx: index('product_views_shop_product_idx').on(t.shopId, t.productId),
    createdAtIdx: index('product_views_created_at_idx').on(t.createdAt),
  }),
);

export const searchQueries = pgTable(
  'search_queries',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    sessionId: text('session_id'),
    shopId: uuid('shop_id').references(() => shops.id, { onDelete: 'set null' }),
    query: text('query').notNull(),
    resultsCount: integer('results_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    createdAtIdx: index('search_queries_created_at_idx').on(t.createdAt),
  }),
);

// ─── Relations ─────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many, one }) => ({
  otpTokens: many(otpTokens),
  refreshTokens: many(refreshTokens),
  addresses: many(addresses),
  shop: one(shops, { fields: [users.id], references: [shops.ownerUserId] }),
  shopMemberships: many(shopMembers),
  carts: many(carts),
  wishlists: many(wishlists),
  orders: many(orders),
  notifications: many(notifications),
}));

export const shopsRelations = relations(shops, ({ one, many }) => ({
  owner: one(users, { fields: [shops.ownerUserId], references: [users.id] }),
  subscription: one(shopSubscriptions, { fields: [shops.id], references: [shopSubscriptions.shopId] }),
  members: many(shopMembers),
  resourceUsage: one(shopResourceUsage, { fields: [shops.id], references: [shopResourceUsage.shopId] }),
  products: many(products),
  warehouses: many(warehouses),
  banners: many(banners),
  coupons: many(coupons),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  shop: one(shops, { fields: [products.shopId], references: [shops.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  variants: many(productVariants),
  media: many(productMedia),
  attributeValues: many(productAttributeValues),
  tags: many(productTags),
  reviews: many(reviews),
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  attributeValues: many(variantAttributeValues),
  media: many(productMedia),
  inventory: many(inventory),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
  statusHistory: many(orderStatusHistory),
  coupon: one(coupons, { fields: [orders.couponId], references: [coupons.id] }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, { fields: [categories.parentId], references: [categories.id] }),
  children: many(categories),
  categoryAttributes: many(categoryAttributes),
}));

export const attributesRelations = relations(attributes, ({ many }) => ({
  options: many(attributeOptions),
  categoryAttributes: many(categoryAttributes),
}));

export const inventoryRelations = relations(inventory, ({ one, many }) => ({
  variant: one(productVariants, { fields: [inventory.variantId], references: [productVariants.id] }),
  warehouse: one(warehouses, { fields: [inventory.warehouseId], references: [warehouses.id] }),
  transactions: many(inventoryTransactions),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, { fields: [addresses.userId], references: [users.id] }),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(users, { fields: [carts.userId], references: [users.id] }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  variant: one(productVariants, { fields: [cartItems.variantId], references: [productVariants.id] }),
}));

export const wishlistsRelations = relations(wishlists, ({ one, many }) => ({
  user: one(users, { fields: [wishlists.userId], references: [users.id] }),
  items: many(wishlistItems),
}));

export const wishlistItemsRelations = relations(wishlistItems, ({ one }) => ({
  wishlist: one(wishlists, { fields: [wishlistItems.wishlistId], references: [wishlists.id] }),
  product: one(products, { fields: [wishlistItems.productId], references: [products.id] }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  shop: one(shops, { fields: [orderItems.shopId], references: [shops.id] }),
  variant: one(productVariants, { fields: [orderItems.variantId], references: [productVariants.id] }),
}));

export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
  order: one(orders, { fields: [orderStatusHistory.orderId], references: [orders.id] }),
  changedBy: one(users, { fields: [orderStatusHistory.changedByUserId], references: [users.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  product: one(products, { fields: [reviews.productId], references: [products.id] }),
  shop: one(shops, { fields: [reviews.shopId], references: [shops.id] }),
  user: one(users, { fields: [reviews.userId], references: [users.id] }),
  order: one(orders, { fields: [reviews.orderId], references: [orders.id] }),
  media: many(reviewMedia),
}));

export const warehousesRelations = relations(warehouses, ({ one, many }) => ({
  shop: one(shops, { fields: [warehouses.shopId], references: [shops.id] }),
  inventory: many(inventory),
}));

export const shopMembersRelations = relations(shopMembers, ({ one }) => ({
  shop: one(shops, { fields: [shopMembers.shopId], references: [shops.id] }),
  user: one(users, { fields: [shopMembers.userId], references: [users.id] }),
  invitedBy: one(users, { fields: [shopMembers.invitedByUserId], references: [users.id] }),
}));

export const shopSubscriptionsRelations = relations(shopSubscriptions, ({ one }) => ({
  shop: one(shops, { fields: [shopSubscriptions.shopId], references: [shops.id] }),
  plan: one(plans, { fields: [shopSubscriptions.planId], references: [plans.id] }),
}));

export const shopResourceUsageRelations = relations(shopResourceUsage, ({ one }) => ({
  shop: one(shops, { fields: [shopResourceUsage.shopId], references: [shops.id] }),
}));

export const attributeOptionsRelations = relations(attributeOptions, ({ one }) => ({
  attribute: one(attributes, { fields: [attributeOptions.attributeId], references: [attributes.id] }),
}));

export const categoryAttributesRelations = relations(categoryAttributes, ({ one }) => ({
  category: one(categories, { fields: [categoryAttributes.categoryId], references: [categories.id] }),
  attribute: one(attributes, { fields: [categoryAttributes.attributeId], references: [attributes.id] }),
}));

export const variantAttributeValuesRelations = relations(variantAttributeValues, ({ one }) => ({
  variant: one(productVariants, { fields: [variantAttributeValues.variantId], references: [productVariants.id] }),
  attribute: one(attributes, { fields: [variantAttributeValues.attributeId], references: [attributes.id] }),
  attributeOption: one(attributeOptions, { fields: [variantAttributeValues.attributeOptionId], references: [attributeOptions.id] }),
}));

export const productAttributeValuesRelations = relations(productAttributeValues, ({ one }) => ({
  product: one(products, { fields: [productAttributeValues.productId], references: [products.id] }),
  attribute: one(attributes, { fields: [productAttributeValues.attributeId], references: [attributes.id] }),
  attributeOption: one(attributeOptions, { fields: [productAttributeValues.attributeOptionId], references: [attributeOptions.id] }),
}));

export const productMediaRelations = relations(productMedia, ({ one }) => ({
  product: one(products, { fields: [productMedia.productId], references: [products.id] }),
  variant: one(productVariants, { fields: [productMedia.variantId], references: [productVariants.id] }),
}));

export const productTagsRelations = relations(productTags, ({ one }) => ({
  product: one(products, { fields: [productTags.productId], references: [products.id] }),
  tag: one(tags, { fields: [productTags.tagId], references: [tags.id] }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  productTags: many(productTags),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const couponUsagesRelations = relations(couponUsages, ({ one }) => ({
  coupon: one(coupons, { fields: [couponUsages.couponId], references: [coupons.id] }),
  user: one(users, { fields: [couponUsages.userId], references: [users.id] }),
}));

export const inventoryTransactionsRelations = relations(inventoryTransactions, ({ one }) => ({
  inventory: one(inventory, { fields: [inventoryTransactions.inventoryId], references: [inventory.id] }),
  createdBy: one(users, { fields: [inventoryTransactions.createdByUserId], references: [users.id] }),
}));

export const bannersRelations = relations(banners, ({ one }) => ({
  shop: one(shops, { fields: [banners.shopId], references: [shops.id] }),
}));

export const reviewMediaRelations = relations(reviewMedia, ({ one }) => ({
  review: one(reviews, { fields: [reviewMedia.reviewId], references: [reviews.id] }),
}));
