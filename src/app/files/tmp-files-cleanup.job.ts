import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FilesService } from './files.service';
import { isTmpCleanupEnabled } from './files.constants';

@Injectable()
export class TmpFilesCleanupJob {
  private readonly logger = new Logger(TmpFilesCleanupJob.name);

  constructor(private readonly filesService: FilesService) {}

  @Cron(process.env.TMP_CLEANUP_CRON ?? CronExpression.EVERY_HOUR)
  async handleCleanup(): Promise<void> {
    if (!isTmpCleanupEnabled()) {
      return;
    }

    const result = await this.filesService.cleanupExpiredFiles();

    if (result.deletedFiles > 0 || result.removedOrphans > 0) {
      this.logger.log(
        `Tmp cleanup: ${result.deletedFiles} expired file(s), ${result.removedOrphans} orphan(s), ${result.prunedUsers} empty user dir(s)`,
      );
    }
  }
}
