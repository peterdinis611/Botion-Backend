import { Module, forwardRef } from '@nestjs/common';
import { NotesService } from './notes.service';
import { NotesResolver } from './notes.resolver';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { NotebooksModule } from '../notebooks/notebooks.module';
import { NoteRevisionsService } from './note-revisions.service';
import { TagsModule } from '../tags/tags.module';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    forwardRef(() => NotebooksModule),
    TagsModule,
  ],
  providers: [NotesService, NotesResolver, NoteRevisionsService],
  exports: [NotesService, NoteRevisionsService],
})
export class NotesModule {}

