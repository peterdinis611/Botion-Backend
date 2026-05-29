import { Module } from '@nestjs/common';
import { NotesModule } from './notes/notes.module';
import { NotebooksModule } from './notebooks/notebooks.module';
import { TagsModule } from './tags/tags.module';
import { FoldersModule } from './folders/folders.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FilesModule } from './files/files.module';
import { CalendarModule } from './calendar/calendar.module';
import { GraphsModule } from './graphs/graphs.module';
import { SnapsModule } from './snaps/snaps.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    NotesModule,
    NotebooksModule,
    TagsModule,
    FoldersModule,
    NotificationsModule,
    FilesModule,
    CalendarModule,
    GraphsModule,
    SnapsModule,
    WorkspaceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppFeaturesModule {}
