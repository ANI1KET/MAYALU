import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../../database/schema/index';

/**
 * Typed Drizzle database instance with full schema awareness.
 * Import this type in every service instead of re-importing NodePgDatabase + schema separately.
 *
 * Usage:
 *   constructor(@Inject(DATABASE_TOKEN) private readonly db: DrizzleDB) {}
 */
export type DrizzleDB = NodePgDatabase<typeof schema>;

/** Re-export schema types for convenience */
export type { schema };
