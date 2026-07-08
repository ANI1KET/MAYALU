import {
  Injectable, Inject, Module, Controller, Get, Patch, Param, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiCookieAuth, ApiParam,
} from '@nestjs/swagger';
import { NotificationDto, MessageResponseDto } from '../../common/swagger/response.dto';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/index';
import { JwtService } from '../../common/services/jwt.service';
import { NOTIFICATION } from '../../common/constants/index';
import { ApiOkEnvelope, ApiStandardErrors } from '../../common/decorators/api-responses.decorator';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getForUser(userId: string) {
    return this.db.query.notifications.findMany({
      where: eq(schema.notifications.userId, userId),
      orderBy: (n, { desc }) => [desc(n.sentAt)],
      limit: NOTIFICATION.MAX_FETCH,
    });
  }

  async markRead(userId: string, notificationId: string) {
    await this.db.update(schema.notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(schema.notifications.id, notificationId),
        eq(schema.notifications.userId, userId),
      ));
    return { read: true };
  }

  async markAllRead(userId: string) {
    await this.db.update(schema.notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(schema.notifications.userId, userId), eq(schema.notifications.isRead, false)));
    return { allRead: true };
  }

  async create(userId: string, type: 'order_update' | 'promo' | 'cart_reminder' | 'general', title: string, body: string, data?: Record<string, unknown>) {
    const [notification] = await this.db.insert(schema.notifications).values({
      userId, type, title, body, dataJson: data ?? {}, isRead: false,
    }).returning();
    return notification;
  }
}

@ApiTags('Notifications')
@UseGuards(AuthGuard)
@ApiCookieAuth('access_token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get my notifications', description: 'Returns up to 50 notifications sorted by newest. Uses partial index on (userId, isRead WHERE false).' })
  @ApiOkEnvelope([NotificationDto], 'Notifications list (max 50, newest first)')
  @ApiStandardErrors()
  getNotifications(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.getForUser(user.sub);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @ApiOkEnvelope(
    MessageResponseDto,
    'Notification marked as read. Note: this is a no-op that still returns success if the ' +
      'notification id does not exist or belongs to another user — the service performs a ' +
      'scoped UPDATE with no existence check, so no 404 is ever thrown here.',
  )
  @ApiStandardErrors()
  markRead(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.notificationsService.markRead(user.sub, id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiOkEnvelope(MessageResponseDto, 'All unread notifications marked as read')
  @ApiStandardErrors()
  markAllRead(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.markAllRead(user.sub);
  }
}

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, JwtService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
