import { Module, forwardRef } from '@nestjs/common';
import { FoldersService } from './folders.service';
import { FoldersResolver } from './folders.resolver';
import { UsersModule } from '../../users/users.module';
import { AuthModule } from '../../auth/auth.module';
import { NotebooksModule } from '../notebooks/notebooks.module';

@Module({
  imports: [UsersModule, AuthModule, forwardRef(() => NotebooksModule)],
  providers: [FoldersService, FoldersResolver],
  exports: [FoldersService],
})
export class FoldersModule {}
