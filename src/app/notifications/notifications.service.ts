import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { EventsPubSubService } from '../../events/events-pub-sub.service';
import { DRIZZLE } from '../../drizzle/drizzle.provider';
import type { DrizzleDB } from '../../drizzle/drizzle.provider';
import { notifications } from '../../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
import { Notification } from './notification.model';
import * as crypto from 'crypto';

export type DbNotification = typeof notifications.$inferSelect;

export function mapDbNotificationToModel(
  dbNotification: DbNotification,
): Notification {
  return {
    id: dbNotification.id,
    userId: dbNotification.userId,
    type: dbNotification.type,
    message: dbNotification.message,
    isRead: dbNotification.isRead,
    createdAt: dbNotification.createdAt,
  };
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly eventsPubSub: EventsPubSubService,
  ) {}

  async findAll(userId: string): Promise<Notification[]> {
    const rows = this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .all();

    return rows.map(mapDbNotificationToModel);
  }

  async create(
    userId: string,
    type: string,
    message: string,
  ): Promise<Notification> {
    const id = crypto.randomUUID();
    const newNotification = {
      id,
      userId,
      type,
      message,
      isRead: false,
    };

    this.db.insert(notifications).values(newNotification).run();

    const results = this.db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .all();

    const created = results[0];
    if (!created) {
      throw new Error('Failed to create notification.');
    }

    const notification = mapDbNotificationToModel(created);
    await this.eventsPubSub.publishNotification(userId, notification);
    return notification;
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    const results = this.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .all();

    const notification = results[0];
    if (!notification) {
      throw new NotFoundException(`Notification with ID "${id}" not found.`);
    }

    this.db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .run();

    return {
      ...mapDbNotificationToModel(notification),
      isRead: true,
    };
  }

  async markAllAsRead(userId: string): Promise<boolean> {
    this.db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId))
      .run();

    return true;
  }
}
