import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
import { NOTIFICATION } from '../../common/constants/index';

@Injectable()
export class NotificationsRepository {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  findManyByUser(userId: string) {
    return this.db.query.notifications.findMany({
      where: eq(schema.notifications.userId, userId),
      orderBy: (n, { desc }) => [desc(n.sentAt)],
      limit: NOTIFICATION.MAX_FETCH,
    });
  }

  markRead(userId: string, notificationId: string) {
    return this.db.update(schema.notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(schema.notifications.id, notificationId),
        eq(schema.notifications.userId, userId),
      ));
  }

  markAllRead(userId: string) {
    return this.db.update(schema.notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(schema.notifications.userId, userId), eq(schema.notifications.isRead, false)));
  }

  async create(userId: string, type: 'order_update' | 'promo' | 'cart_reminder' | 'general', title: string, body: string, data?: Record<string, unknown>) {
    const [notification] = await this.db.insert(schema.notifications).values({
      userId, type, title, body, dataJson: data ?? {}, isRead: false,
    }).returning();
    return notification;
  }
}
