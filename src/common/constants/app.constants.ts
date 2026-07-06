/**
 * Plan & Resource Constants
 */

/** Sentinel value meaning "no limit" on a plan resource */
export const UNLIMITED = -1;

/** Default plan assigned to new shops */
export const DEFAULT_PLAN_SLUG = 'starter';

/** Default plan limits used as fallback when subscription not found */
export const DEFAULT_PLAN_LIMITS = {
  maxProducts: 50,
  maxVariantsPerProduct: 10,
  maxImagesPerProduct: 5,
  maxWarehouses: 1,
  maxStaffMembers: 1,
} as const;

/** Trial period for new subscriptions in days */
export const TRIAL_PERIOD_DAYS = 30;

/**
 * Pagination Constants
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  /** Hard cap — prevents accidental full-table dumps */
  MAX_LIMIT: 100,
} as const;

/**
 * Media / Storage Constants
 */
export const MEDIA = {
  /** Max file size for product images in bytes (5 MB) */
  MAX_IMAGE_BYTES: 5 * 1024 * 1024,
  /** Max file size for GIFs in bytes (10 MB) */
  MAX_GIF_BYTES: 10 * 1024 * 1024,
  /** Supported MIME types for product media */
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as const,
  ALLOWED_GIF_TYPES: ['image/gif'] as const,
  /** Cloudinary upload preset subfolder for products */
  PRODUCTS_SUBFOLDER: 'products',
  /** Cloudinary upload preset subfolder for shop logos */
  SHOPS_SUBFOLDER: 'shops',
  /** Cloudinary upload preset subfolder for banners */
  BANNERS_SUBFOLDER: 'banners',
  /** Cloudinary upload preset subfolder for review media */
  REVIEWS_SUBFOLDER: 'reviews',
} as const;

/**
 * Rate Limiting Constants
 */
export const RATE_LIMIT = {
  /** Global throttle window in milliseconds */
  GLOBAL_TTL_MS: 60_000,
  /** Global max requests per window */
  GLOBAL_MAX: 100,
  /** Auth endpoints throttle window */
  AUTH_TTL_MS: 60_000,
  /** Auth endpoints max requests (5/min prevents brute force) */
  AUTH_MAX: 5,
} as const;

/**
 * Notification Constants
 */
export const NOTIFICATION = {
  /** Max notifications returned per query */
  MAX_FETCH: 50,
} as const;

/**
 * Review Constants
 */
export const REVIEW = {
  MIN_RATING: 1,
  MAX_RATING: 5,
  MAX_COMMENT_LENGTH: 1_000,
} as const;

/**
 * Cart Constants
 */
export const CART = {
  MAX_QUANTITY_PER_ITEM: 99,
  /** Guest cart TTL in days */
  GUEST_EXPIRY_DAYS: 7,
} as const;
