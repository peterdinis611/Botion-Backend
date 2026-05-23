import { Module } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarResolver } from './calendar.resolver';
import { UsersModule } from '../../users/users.module';
import { AuthModule } from '../../auth/auth.module';
import { CacheModule } from '../../cache/cache.module';

@Module({
  imports: [UsersModule, AuthModule, CacheModule],
  providers: [CalendarService, CalendarResolver],
  exports: [CalendarService],
})
export class CalendarModule {}
