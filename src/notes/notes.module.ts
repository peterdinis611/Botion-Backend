import { Module, forwardRef } from '@nestjs/common';
import { NotesService } from './notes.service';
import { NotesResolver } from './notes.resolver';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { NotebooksModule } from '../notebooks/notebooks.module';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    forwardRef(() => NotebooksModule),
  ],
  providers: [NotesService, NotesResolver],
  exports: [NotesService],
})
export class NotesModule {}
