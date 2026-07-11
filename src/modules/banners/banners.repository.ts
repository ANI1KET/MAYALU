import { Injectable, Inject } from '@nestjs/common';
import { eq, and, or, isNull, lte, gte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';

@Injectable()
export class BannersRepository {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  findActiveBanners(now: Date, position?: 'hero' | 'category' | 'promo', shopId?: string) {
    return this.db.query.banners.findMany({
      where: and(
        eq(schema.banners.isActive, true),
        position ? eq(schema.banners.position, position) : undefined,
        shopId
          ? or(eq(schema.banners.shopId, shopId), isNull(schema.banners.shopId))
          : isNull(schema.banners.shopId),
        or(isNull(schema.banners.startsAt), lte(schema.banners.startsAt, now)),
        or(isNull(schema.banners.endsAt), gte(schema.banners.endsAt, now)),
      ),
      orderBy: (b, { asc }) => [asc(b.sortOrder)],
    });
  }
}
