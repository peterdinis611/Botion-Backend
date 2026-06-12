import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE } from '../../drizzle/drizzle.provider';
import type { DrizzleDB } from '../../drizzle/drizzle.provider';
import { calendarEvents } from '../../drizzle/schema';
import { and, eq, gte, lte } from 'drizzle-orm';
import * as crypto from 'crypto';
import {
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from './calendar.dto';
import { CalendarEvent } from './calendar-event.model';
import { CacheService } from '../../cache/cache.service';
import { EventsPubSubService } from '../../events/events-pub-sub.service';
import { AppEventAction } from '../../events/app-event-action.enum';

import {
  CACHE_TTL_DETAIL_MS,
  CACHE_TTL_LIST_HOT_MS,
} from '../../cache/cache.constants';

const CALENDAR_LIST_TTL_MS = CACHE_TTL_LIST_HOT_MS;
const CALENDAR_DETAIL_TTL_MS = CACHE_TTL_DETAIL_MS;

export type DbCalendarEvent = typeof calendarEvents.$inferSelect;

export function mapDbCalendarEventToModel(row: DbCalendarEvent): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    userId: row.userId,
    startAt: row.startAt,
    endAt: row.endAt,
    allDay: row.allDay,
    color: row.color,
    location: row.location ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class CalendarService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly cacheService: CacheService,
    private readonly eventsPubSub: EventsPubSubService,
  ) {}

  async findAll(
    userId: string,
    options?: { from?: string; to?: string },
  ): Promise<CalendarEvent[]> {
    const cacheKey = this.listCacheKey(userId, options);
    const cached = this.cacheService.get<CalendarEvent[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const conditions = [eq(calendarEvents.userId, userId)];
    if (options?.from) {
      conditions.push(gte(calendarEvents.endAt, options.from));
    }
    if (options?.to) {
      conditions.push(lte(calendarEvents.startAt, options.to));
    }

    const rows = this.db
      .select()
      .from(calendarEvents)
      .where(and(...conditions))
      .all();

    const result = rows
      .map(mapDbCalendarEventToModel)
      .sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );

    this.cacheService.set(cacheKey, result, CALENDAR_LIST_TTL_MS);
    return result;
  }

  async findOne(id: string, userId: string): Promise<CalendarEvent> {
    const cacheKey = `calendar-event:${id}:user:${userId}`;
    const cached = this.cacheService.get<CalendarEvent>(cacheKey);
    if (cached) {
      return cached;
    }

    const row = this.db
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, userId)))
      .all()[0];

    if (!row) {
      throw new NotFoundException(`Calendar event with ID "${id}" not found.`);
    }

    const model = mapDbCalendarEventToModel(row);
    this.cacheService.set(cacheKey, model, CALENDAR_DETAIL_TTL_MS);
    return model;
  }

  async create(
    input: CreateCalendarEventInput,
    userId: string,
  ): Promise<CalendarEvent> {
    this.assertValidRange(input.startAt, input.endAt);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db
      .insert(calendarEvents)
      .values({
        id,
        title: input.title,
        description: input.description ?? null,
        userId,
        startAt: input.startAt,
        endAt: input.endAt,
        allDay: input.allDay ?? false,
        color: input.color ?? '#3b82f6',
        location: input.location ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    this.invalidateUserCaches(userId);
    const event = await this.findOne(id, userId);
    await this.eventsPubSub.publishCalendarEvent(
      userId,
      AppEventAction.CALENDAR_EVENT_CREATED,
      event,
    );
    return event;
  }

  async update(
    input: UpdateCalendarEventInput,
    userId: string,
  ): Promise<CalendarEvent> {
    const existing = await this.findOne(input.id, userId);
    const startAt = input.startAt ?? existing.startAt;
    const endAt = input.endAt ?? existing.endAt;
    this.assertValidRange(startAt, endAt);

    const { id, ...updateData } = input;
    const cleanedData = Object.fromEntries(
      Object.entries(updateData).filter(([_, v]) => v !== undefined),
    ) as Record<string, unknown>;

    cleanedData.updatedAt = new Date().toISOString();

    this.db
      .update(calendarEvents)
      .set(cleanedData)
      .where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, userId)))
      .run();

    this.invalidateUserCaches(userId, id);
    const event = await this.findOne(id, userId);
    await this.eventsPubSub.publishCalendarEvent(
      userId,
      AppEventAction.CALENDAR_EVENT_UPDATED,
      event,
    );
    return event;
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const event = await this.findOne(id, userId);

    await this.eventsPubSub.publishCalendarEvent(
      userId,
      AppEventAction.CALENDAR_EVENT_DELETED,
      event,
    );

    this.db
      .delete(calendarEvents)
      .where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, userId)))
      .run();

    this.invalidateUserCaches(userId, id);
    return true;
  }

  private assertValidRange(startAt: string, endAt: string): void {
    if (new Date(endAt).getTime() < new Date(startAt).getTime()) {
      throw new BadRequestException('endAt must be on or after startAt.');
    }
  }

  private listCacheKey(
    userId: string,
    options?: { from?: string; to?: string },
  ): string {
    return `user:${userId}:calendar:${options?.from ?? ''}:${options?.to ?? ''}`;
  }

  private invalidateUserCaches(userId: string, eventId?: string): void {
    this.cacheService.clearPattern(`user:${userId}:calendar:*`);
    if (eventId) {
      this.cacheService.delete(`calendar-event:${eventId}:user:${userId}`);
    }
  }
}
