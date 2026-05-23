import { Global, Module } from '@nestjs/common';
import { EventsPubSubService } from './events-pub-sub.service';
import { EventsResolver } from './events.resolver';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [AuthModule],
  providers: [EventsPubSubService, EventsResolver],
  exports: [EventsPubSubService],
})
export class EventsModule {}
