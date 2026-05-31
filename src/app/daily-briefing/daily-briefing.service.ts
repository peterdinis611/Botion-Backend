import { BadRequestException, Injectable } from '@nestjs/common';
import { CalendarService } from '../calendar/calendar.service';
import { CalendarEvent } from '../calendar/calendar-event.model';
import { Note } from '../notes/note.model';
import { NotesService } from '../notes/notes.service';
import { DailyBriefing } from './daily-briefing.model';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dayStartISO(dateKey: string): string {
  const d = parseDateKey(dateKey);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function dayEndISO(dateKey: string): string {
  const d = parseDateKey(dateKey);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function eventOverlapsDay(event: CalendarEvent, dateKey: string): boolean {
  const dayStart = new Date(dayStartISO(dateKey)).getTime();
  const dayEnd = new Date(dayEndISO(dateKey)).getTime();
  const start = new Date(event.startAt).getTime();
  const end = new Date(event.endAt).getTime();
  return start <= dayEnd && end >= dayStart;
}

function noteTouchesDay(note: Note, dateKey: string): boolean {
  const dayStart = new Date(dayStartISO(dateKey)).getTime();
  const dayEnd = new Date(dayEndISO(dateKey)).getTime();
  const updated = new Date(note.updatedAt).getTime();
  return updated >= dayStart && updated <= dayEnd;
}

@Injectable()
export class DailyBriefingService {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly notesService: NotesService,
  ) {}

  async getBriefing(userId: string, date: string): Promise<DailyBriefing> {
    if (!DATE_KEY_PATTERN.test(date)) {
      throw new BadRequestException('date must be YYYY-MM-DD.');
    }

    const from = dayStartISO(date);
    const to = dayEndISO(date);

    const [events, notes] = await Promise.all([
      this.calendarService.findAll(userId, { from, to }),
      this.notesService.findAll(userId, { includeArchived: false }),
    ]);

    const calendarEvents = events
      .filter((event) => eventOverlapsDay(event, date))
      .sort(
        (a, b) =>
          new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );

    const importantNotes = notes
      .filter((note) => note.isPinned || noteTouchesDay(note, date))
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1;
        }
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      })
      .slice(0, 12);

    return {
      date,
      calendarEvents,
      importantNotes,
    };
  }
}
