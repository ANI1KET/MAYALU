/**
 * Authentication & Security Constants
 * Single source of truth for all timing, security, and OTP-related values.
 * Change here to affect the entire application.
 */

/** Argon2id hashing parameters for OTP codes */
export const ARGON2_CONFIG = {
  type: 'argon2id' as const,
  memoryCost: 4_096,   // 4 MB – fast enough for OTP, safe enough against GPU attacks
  timeCost: 1,
  parallelism: 1,
} as const;

/** OTP lifecycle */
export const OTP = {
  /** Length of generated OTP in digits */
  LENGTH: 6,
  /** Random bytes needed to generate LENGTH digits (3 bytes → 0-16777215 → mod 1_000_000) */
  RANDOM_BYTES: 3,
  /** Modulus to produce a 6-digit number */
  MODULUS: 1_000_000,
  /** OTP validity window in minutes (overridden by env OTP_EXPIRY_MINUTES) */
  DEFAULT_EXPIRY_MINUTES: 5,
  /** Max wrong attempts before OTP is locked (overridden by env OTP_MAX_ATTEMPTS) */
  DEFAULT_MAX_ATTEMPTS: 3,
  /** Minimum seconds between send requests per phone+purpose (overridden by env) */
  DEFAULT_COOLDOWN_SECONDS: 60,
} as const;

/** JWT access token */
export const JWT = {
  ALGORITHM: 'HS256' as const,
  /** Access token lifetime (overridden by env JWT_ACCESS_EXPIRY) */
  DEFAULT_ACCESS_EXPIRY: '15m',
  /** Refresh token lifetime in days (overridden by env JWT_REFRESH_EXPIRE_DAYS) */
  DEFAULT_REFRESH_EXPIRE_DAYS: 30,
  /** Minimum acceptable secret length to prevent weak secrets */
  MIN_SECRET_LENGTH: 32,
  /** Refresh token raw byte length → 96-char hex string */
  REFRESH_TOKEN_BYTES: 48,
} as const;

/** Cookie configuration */
export const COOKIE = {
  ACCESS_TOKEN_NAME: 'access_token',
  REFRESH_TOKEN_NAME: 'refresh_token',
  /** Refresh token is path-scoped so it's never sent on non-refresh routes */
  REFRESH_TOKEN_PATH: '/api/v1/auth/refresh',
  /** Access token max age in seconds (must match JWT.DEFAULT_ACCESS_EXPIRY) */
  ACCESS_MAX_AGE_SECONDS: 15 * 60,           // 15 minutes
  /** Refresh token max age in seconds */
  REFRESH_MAX_AGE_SECONDS: 30 * 24 * 60 * 60, // 30 days
} as const;

/** Admin API */
export const ADMIN = {
  HEADER_NAME: 'x-admin-key',
  MIN_KEY_LENGTH: 16,
} as const;
