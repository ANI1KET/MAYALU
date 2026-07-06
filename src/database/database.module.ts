import { Module, Global, Logger } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index';
import { getConfig } from '../config/app.config';

export const DATABASE_TOKEN = 'DATABASE';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_TOKEN,
      useFactory: () => {
        const config = getConfig();
        const logger = new Logger('DatabaseModule');

        const pool = new Pool({
          connectionString: config.DATABASE_URL,
          max: config.DATABASE_MAX_CONNECTIONS,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
        });

        pool.on('error', (err: Error) => {
          logger.error(`Unexpected PostgreSQL pool error: ${err.message}`, err.stack);
        });

        pool.on('connect', () => {
          logger.debug('PostgreSQL connection established');
        });

        const db = drizzle(pool, { schema, logger: config.NODE_ENV === 'development' });
        logger.log(`Database connected — pool max: ${config.DATABASE_MAX_CONNECTIONS}`);
        return db;
      },
    },
  ],
  exports: [DATABASE_TOKEN],
})
export class DatabaseModule {}
