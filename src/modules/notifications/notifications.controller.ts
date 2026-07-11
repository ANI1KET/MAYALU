import { Controller, Get, Patch, Param } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiCookieAuth, ApiParam,
} from '@nestjs/swagger';
import { NotificationDto, MessageResponseDto } from '../../common/swagger/response.dto';
import { CurrentUser } from '../../common/decorators/index';
import { ApiOkEnvelope, ApiStandardErrors } from '../../common/decorators/api-responses.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
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
