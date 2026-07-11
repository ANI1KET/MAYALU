import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';

@Injectable()
export class CouponsRepository {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  findActiveByCode(code: string) {
    return this.db.query.coupons.findFirst({
      where: and(eq(schema.coupons.code, code), eq(schema.coupons.isActive, true)),
    });
  }

  findUsagesByCouponAndUser(couponId: string, userId: string) {
    return this.db.query.couponUsages.findMany({
      where: and(eq(schema.couponUsages.couponId, couponId), eq(schema.couponUsages.userId, userId)),
    });
  }
}
