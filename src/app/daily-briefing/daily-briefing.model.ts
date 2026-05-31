import { Field, ObjectType } from '@nestjs/graphql';
import { CalendarEvent } from '../calendar/calendar-event.model';
import { Note } from '../notes/note.model';

@ObjectType()
export class DailyBriefing {
  @Field()
  date: string;

  @Field(() => [CalendarEvent])
  calendarEvents: CalendarEvent[];

  @Field(() => [Note])
  importantNotes: Note[];
}
