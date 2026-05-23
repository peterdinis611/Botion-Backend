import { Test, TestingModule } from '@nestjs/testing';
import { TmpFilesCleanupJob } from './tmp-files-cleanup.job';
import { FilesService } from './files.service';

describe('TmpFilesCleanupJob', () => {
  let job: TmpFilesCleanupJob;
  let filesService: { cleanupExpiredFiles: jest.Mock };

  beforeEach(async () => {
    filesService = {
      cleanupExpiredFiles: jest.fn().mockResolvedValue({
        deletedFiles: 2,
        removedOrphans: 0,
        prunedUsers: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TmpFilesCleanupJob,
        { provide: FilesService, useValue: filesService },
      ],
    }).compile();

    job = module.get(TmpFilesCleanupJob);
  });

  it('runs cleanup on schedule handler', async () => {
    await job.handleCleanup();
    expect(filesService.cleanupExpiredFiles).toHaveBeenCalledTimes(1);
  });
});
