import { Injectable } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { AppEventAction } from './app-event-action.enum';
import { AppEvent } from './app-event.model';
import { Notification } from '../app/notifications/notification.model';
import { Note } from '../app/notes/note.model';
import { CalendarEvent } from '../app/calendar/calendar-event.model';

export const notificationChannel = (userId: string) =>
  `user:${userId}:notifications`;

export const appEventChannel = (userId: string) => `user:${userId}:events`;

@Injectable()
export class EventsPubSubService {
  private readonly pubSub = new PubSub();

  async publishNotification(
    userId: string,
    notification: Notification,
  ): Promise<void> {
    await this.pubSub.publish(notificationChannel(userId), {
      notificationAdded: notification,
    });

    await this.publishAppEvent(userId, {
      action: AppEventAction.NOTIFICATION_CREATED,
      userId,
      entityId: notification.id,
      notification,
    });
  }

  async publishNoteEvent(
    userId: string,
    action: AppEventAction,
    note: Note,
  ): Promise<void> {
    await this.publishAppEvent(userId, {
      action,
      userId,
      entityId: note.id,
      note,
    });
  }

  async broadcastNoteEvent(
    recipientUserIds: string[],
    action: AppEventAction,
    note: Note,
    actorUserId?: string,
  ): Promise<void> {
    const unique = [...new Set(recipientUserIds.filter(Boolean))];
    await Promise.all(
      unique.map(async (recipientId) => {
        if (actorUserId && recipientId === actorUserId) return;
        await this.publishNoteEvent(recipientId, action, note);
      }),
    );
  }

  async publishCalendarEvent(
    userId: string,
    action: AppEventAction,
    calendarEvent: CalendarEvent,
  ): Promise<void> {
    await this.publishAppEvent(userId, {
      action,
      userId,
      entityId: calendarEvent.id,
      calendarEvent,
    });
  }

  async publishAppEvent(userId: string, event: AppEvent): Promise<void> {
    await this.pubSub.publish(appEventChannel(userId), { appEvent: event });
  }

  notificationIterator(userId: string) {
    return this.pubSub.asyncIterableIterator<{
      notificationAdded: Notification;
    }>(notificationChannel(userId));
  }

  appEventIterator(userId: string) {
    return this.pubSub.asyncIterableIterator<{ appEvent: AppEvent }>(
      appEventChannel(userId),
    );
  }
}
