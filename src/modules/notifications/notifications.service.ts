import { Injectable } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(private readonly notificationsRepository: NotificationsRepository) {}

  async getForUser(userId: string) {
    return this.notificationsRepository.findManyByUser(userId);
  }

  async markRead(userId: string, notificationId: string) {
    await this.notificationsRepository.markRead(userId, notificationId);
    return { read: true };
  }

  async markAllRead(userId: string) {
    await this.notificationsRepository.markAllRead(userId);
    return { allRead: true };
  }

  async create(userId: string, type: 'order_update' | 'promo' | 'cart_reminder' | 'general', title: string, body: string, data?: Record<string, unknown>) {
    return this.notificationsRepository.create(userId, type, title, body, data);
  }
}
