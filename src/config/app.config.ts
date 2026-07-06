import { z } from 'zod';

/**
 * Application configuration validated with Zod on startup.
 * If any required variable is missing or invalid, the process exits with a clear error.
 * All magic values live in src/common/constants/ — this file only does env→typed-value mapping.
 */
const configSchema = z.object({
  // ── App ────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8000),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((v) => v.split(',').map((o) => o.trim())),

  // ── Database ────────────────────────────────────────────────────────
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().int().min(1).max(100).default(10),

  // ── JWT ─────────────────────────────────────────────────────────────
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRE_DAYS: z.coerce.number().int().min(1).default(30),
  JWT_ISSUER: z.string().default('mayalu-wears'),
  JWT_AUDIENCE: z.string().default('mayalu-wears-app'),

  // ── OTP ─────────────────────────────────────────────────────────────
  OTP_EXPIRY_MINUTES: z.coerce.number().int().min(1).max(30).default(5),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().min(10).max(300).default(60),

  // ── SMS ─────────────────────────────────────────────────────────────
  SMS_PROVIDER: z.enum(['sparrow', 'mock']).default('mock'),
  SPARROW_SMS_TOKEN: z.string().optional(),
  SPARROW_SMS_FROM: z.string().optional(),
  SMS_DEBUG: z.coerce.boolean().default(true),

  // ── Cloudinary ──────────────────────────────────────────────────────
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME is required'),
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is required'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is required'),
  CLOUDINARY_FOLDER: z.string().default('mayalu-wears'),

  // ── Rate Limiting ────────────────────────────────────────────────────
  RATE_LIMIT_TTL: z.coerce.number().int().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().default(100),
  AUTH_THROTTLE_TTL: z.coerce.number().int().default(60_000),
  AUTH_THROTTLE_MAX: z.coerce.number().int().default(5),

  // ── Admin ───────────────────────────────────────────────────────────
  ADMIN_SECRET_KEY: z.string().min(16, 'ADMIN_SECRET_KEY must be at least 16 characters'),
  /** Comma-separated list of user UUIDs with platform admin access */
  ADMIN_USER_IDS: z.string().default(''),

  // ── Logging ─────────────────────────────────────────────────────────
  LOG_LEVEL: z
    .enum(['error', 'warn', 'log', 'debug', 'verbose'])
    .default('debug'),
  LOG_PRETTY: z.coerce.boolean().default(true),
});

export type AppEnv = z.infer<typeof configSchema>;

let _config: AppEnv | null = null;

/**
 * Validate env vars and cache result.
 * Called once during bootstrap — throws with a clear message if validation fails.
 */
export function validateConfig(env: NodeJS.ProcessEnv): AppEnv {
  const result = configSchema.safeParse(env);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  • ${e.path.join('.')}: ${e.message}`)
      .join('\n');

    throw new Error(
      `\n\n❌ Configuration validation failed — fix these env variables:\n${errors}\n`,
    );
  }

  _config = result.data;
  return result.data;
}

/** Get cached config after validation. Calls validateConfig on first use. */
export function getConfig(): AppEnv {
  if (!_config) {
    return validateConfig(process.env as NodeJS.ProcessEnv);
  }
  return _config;
}
