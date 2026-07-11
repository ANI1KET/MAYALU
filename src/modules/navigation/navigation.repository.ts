import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';

@Injectable()
export class NavigationRepository {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  findShopMembership(userId: string) {
    return this.db.query.shopMembers.findFirst({
      where: and(
        eq(schema.shopMembers.userId, userId),
        isNull(schema.shopMembers.revokedAt),
      ),
      with: {
        shop: { with: { subscription: true } as never },
      } as never,
    });
  }

  countUnreadNotifications(userId: string) {
    return this.db.execute<{ count: string }>(
      sql`SELECT COUNT(*)::text AS count
          FROM notifications
          WHERE user_id = ${userId} AND is_read = false`,
    );
  }

  countAllPendingOrders() {
    return this.db.execute<{ count: string }>(
      sql`SELECT COUNT(*)::text AS count FROM orders WHERE status = 'pending'`,
    );
  }

  countShopPendingOrders(shopId: string) {
    return this.db.execute<{ count: string }>(
      sql`SELECT COUNT(DISTINCT o.id)::text AS count
          FROM orders o
          INNER JOIN order_items oi ON oi.order_id = o.id
          WHERE o.status = 'pending' AND oi.shop_id = ${shopId}`,
    );
  }

  countCustomerPendingOrders(userId: string) {
    return this.db.execute<{ count: string }>(
      sql`SELECT COUNT(*)::text AS count
          FROM orders WHERE user_id = ${userId} AND status IN ('pending','confirmed','packed','shipped')`,
    );
  }
}
