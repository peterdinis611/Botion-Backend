import { ObjectType, Field, ID } from '@nestjs/graphql';
import { AppEventAction } from './app-event-action.enum';
import { Notification } from '../app/notifications/notification.model';
import { Note } from '../app/notes/note.model';
import { CalendarEvent } from '../app/calendar/calendar-event.model';

@ObjectType()
export class AppEvent {
  @Field(() => AppEventAction)
  action: AppEventAction;

  @Field()
  userId: string;

  @Field(() => ID, { nullable: true })
  entityId?: string;

  @Field(() => Notification, { nullable: true })
  notification?: Notification;

  @Field(() => Note, { nullable: true })
  note?: Note;

  @Field(() => CalendarEvent, { nullable: true })
  calendarEvent?: CalendarEvent;
}
