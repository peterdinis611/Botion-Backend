import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module';
import { NotesModule } from '../notes/notes.module';
import { DailyBriefingResolver } from './daily-briefing.resolver';
import { DailyBriefingService } from './daily-briefing.service';

@Module({
  imports: [CalendarModule, NotesModule],
  providers: [DailyBriefingService, DailyBriefingResolver],
  exports: [DailyBriefingService],
})
export class DailyBriefingModule {}
