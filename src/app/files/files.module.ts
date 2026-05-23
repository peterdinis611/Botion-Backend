import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { TmpFilesCleanupJob } from './tmp-files-cleanup.job';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FilesController],
  providers: [FilesService, TmpFilesCleanupJob],
  exports: [FilesService],
})
export class FilesModule {}
