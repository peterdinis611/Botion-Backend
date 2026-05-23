import { Module, forwardRef } from '@nestjs/common';
import { NotebooksService } from './notebooks.service';
import { NotebooksResolver } from './notebooks.resolver';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { NotesModule } from '../notes/notes.module';
import { FoldersModule } from '../folders/folders.module';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    forwardRef(() => NotesModule),
    forwardRef(() => FoldersModule),
  ],
  providers: [NotebooksService, NotebooksResolver],
  exports: [NotebooksService],
})
export class NotebooksModule {}
