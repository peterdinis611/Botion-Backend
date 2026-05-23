import { Test, TestingModule } from '@nestjs/testing';
import { FilesService } from './files.service';
import { BadRequestException } from '@nestjs/common';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: () => 'test-file-id',
}));

describe('FilesService', () => {
  let service: FilesService;
  const testUserId = 'user-1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FilesService],
    }).compile();

    service = module.get(FilesService);
    await service.onModuleInit();
    await mkdir(join(process.cwd(), 'tmp', testUserId), { recursive: true });
  });

  afterEach(async () => {
    await rm(join(process.cwd(), 'tmp', testUserId), {
      recursive: true,
      force: true,
    });
  });

  it('uploads a file into the tmp folder', async () => {
    const record = await service.upload(testUserId, {
      originalname: 'notes.txt',
      mimetype: 'text/plain',
      size: 5,
      buffer: Buffer.from('hello'),
    } as Express.Multer.File);

    expect(record).toMatchObject({
      id: 'test-file-id',
      originalName: 'notes.txt',
      storedName: 'test-file-id.txt',
      mimeType: 'text/plain',
      size: 5,
    });

    const listed = await service.list(testUserId);
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe('test-file-id');
  });

  it('deletes expired files during cleanup', async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const userDir = join(process.cwd(), 'tmp', testUserId);

    await writeFile(join(userDir, 'old-id.txt'), 'stale');
    await writeFile(
      join(userDir, '.uploads.json'),
      JSON.stringify([
        {
          id: 'old-id',
          originalName: 'old.txt',
          storedName: 'old-id.txt',
          mimeType: 'text/plain',
          size: 5,
          uploadedAt: oldDate,
        },
      ]),
    );

    const result = await service.cleanupExpiredFiles();

    expect(result.deletedFiles).toBe(1);
    expect(await service.list(testUserId)).toHaveLength(0);
  });

  it('rejects empty uploads', async () => {
    await expect(
      service.upload(testUserId, {
        originalname: 'empty.txt',
        mimetype: 'text/plain',
        size: 0,
        buffer: Buffer.alloc(0),
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
