import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SnapsService } from './snaps.service';
import { DRIZZLE } from '../../drizzle/drizzle.provider';
import { FilesService } from '../files/files.service';
import { NotebooksService } from '../notebooks/notebooks.service';
import { NotesService } from '../notes/notes.service';
import { CacheService } from '../../cache/cache.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SnapListScope } from './snap.dto';

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: () => 'snap-1',
}));

describe('SnapsService', () => {
  let service: SnapsService;
  let db: {
    select: jest.Mock;
    from: jest.Mock;
    where: jest.Mock;
    orderBy: jest.Mock;
    all: jest.Mock;
    insert: jest.Mock;
    values: jest.Mock;
    run: jest.Mock;
  };

  const filesService = {
    findRecord: jest.fn().mockResolvedValue({
      id: 'file-1',
      mimeType: 'image/png',
      originalName: 'test.png',
    }),
    remove: jest.fn().mockResolvedValue(true),
  };

  const notebooksService = {
    findOne: jest.fn().mockResolvedValue({ id: 'nb-1', userId: 'user-1' }),
  };

  const notesService = {
    findOne: jest.fn().mockResolvedValue({
      id: 'note-1',
      userId: 'user-1',
      notebookId: 'nb-1',
    }),
  };

  beforeEach(async () => {
    db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      all: jest.fn().mockReturnValue([]),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      run: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnapsService,
        { provide: DRIZZLE, useValue: db },
        { provide: FilesService, useValue: filesService },
        { provide: NotebooksService, useValue: notebooksService },
        { provide: NotesService, useValue: notesService },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn().mockReturnValue(null),
            set: jest.fn(),
            clearPattern: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: { create: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    service = module.get(SnapsService);
    jest.clearAllMocks();
  });

  it('rejects non-image files', async () => {
    filesService.findRecord.mockResolvedValueOnce({
      id: 'file-1',
      mimeType: 'application/pdf',
    });

    await expect(
      service.create({ fileId: 'file-1' }, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires noteId for NOTE scope', async () => {
    await expect(
      service.findAll('user-1', { scope: SnapListScope.NOTE }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a snap and notifies the user', async () => {
    db.all
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        {
          id: 'snap-1',
          userId: 'user-1',
          title: 'My snap',
          caption: null,
          fileId: 'file-1',
          mimeType: 'image/png',
          notebookId: 'nb-1',
          noteId: null,
          sortOrder: 0,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ]);

    const snap = await service.create(
      { fileId: 'file-1', title: 'My snap', notebookId: 'nb-1' },
      'user-1',
    );

    expect(snap.id).toBe('snap-1');
    expect(notebooksService.findOne).toHaveBeenCalledWith('nb-1', 'user-1');
    expect(db.insert).toHaveBeenCalled();
  });
});
