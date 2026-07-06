/**
 * Order & Delivery Constants
 */

/** Order number generation */
export const ORDER = {
  NUMBER_PREFIX: 'MW',
  /** Number of digits in the timestamp-based suffix */
  SUFFIX_LENGTH: 6,
  /** Max customer notes length */
  MAX_NOTES_LENGTH: 500,
} as const;

/**
 * Delivery charges in NPR by zone.
 * inside_valley = KTM Valley (Kathmandu, Lalitpur, Bhaktapur) — free delivery.
 * outside_valley = All other major cities/towns.
 * remote = Hill districts (Humla, Dolpa, Mustang, Mugu).
 */
export const DELIVERY_CHARGE_NPR: Record<string, number> = {
  inside_valley: 0,
  outside_valley: 100,
  remote: 200,
} as const;

/** Estimated delivery time strings shown to customers */
export const ESTIMATED_DELIVERY: Record<string, string> = {
  inside_valley: '1-2 business days',
  outside_valley: '3-5 business days',
  remote: '7-14 business days',
} as const;

/** Delivery serviceability cache TTL in milliseconds (24 hours) */
export const DELIVERY_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;

/** Default origin zone code when no warehouse address is configured */
export const DEFAULT_ORIGIN_ZONE_CODE = 'KTM';
