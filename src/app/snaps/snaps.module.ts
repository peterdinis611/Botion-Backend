import { Module } from '@nestjs/common';
import { SnapsService } from './snaps.service';
import { SnapsResolver } from './snaps.resolver';
import { FilesModule } from '../files/files.module';
import { AuthModule } from '../../auth/auth.module';
import { CacheModule } from '../../cache/cache.module';
import { NotebooksModule } from '../notebooks/notebooks.module';
import { NotesModule } from '../notes/notes.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    FilesModule,
    AuthModule,
    CacheModule,
    NotebooksModule,
    NotesModule,
    NotificationsModule,
  ],
  providers: [SnapsService, SnapsResolver],
  exports: [SnapsService],
})
export class SnapsModule {}
