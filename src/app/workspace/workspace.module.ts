import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { WorkspaceResolver } from './workspace.resolver';
import { NotesModule } from '../notes/notes.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../../auth/auth.module';
import { UsersModule } from '../../users/users.module';

@Module({
  imports: [NotesModule, NotificationsModule, AuthModule, UsersModule],
  providers: [WorkspaceService, WorkspaceResolver],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
