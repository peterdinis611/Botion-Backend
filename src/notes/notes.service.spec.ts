import { Test, TestingModule } from '@nestjs/testing';
import { NotesService } from './notes.service';
import { DRIZZLE } from '../drizzle/drizzle.provider';
import { TagsService } from '../tags/tags.service';
import { NoteRevisionsService } from './note-revisions.service';
import { CacheService } from '../cache/cache.service';
import * as crypto from 'crypto';

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: () => '1',
}));

describe('NotesService', () => {
  let service: NotesService;
  let db: any;
  let tagsService: any;
  let noteRevisionsService: any;
  let cacheService: any;

  beforeEach(async () => {
    db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      all: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      run: jest.fn(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };

    tagsService = {
      setNoteTags: jest.fn(),
      findTagsForNote: jest.fn(),
    };

    noteRevisionsService = {
      createRevision: jest.fn(),
      findAllForNote: jest.fn(),
      findOne: jest.fn(),
    };

    cacheService = {
      get: jest.fn().mockReturnValue(null),
      set: jest.fn(),
      delete: jest.fn(),
      clearPattern: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        { provide: DRIZZLE, useValue: db },
        { provide: TagsService, useValue: tagsService },
        { provide: NoteRevisionsService, useValue: noteRevisionsService },
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get<NotesService>(NotesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return cached result on cache hit without querying the DB', async () => {
      const cached = [
        { id: '1', title: 'Cached', content: 'Body', userId: 'user1' },
      ];
      cacheService.get.mockReturnValue(cached);

      const result = await service.findAll('user1', { includeArchived: false });

      expect(result).toBe(cached);
      expect(db.select).not.toHaveBeenCalled();
      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('should query DB and populate cache on cache miss', async () => {
      const mockNotes = [
        {
          id: '1',
          title: 'Pinned Note',
          content: 'This is pinned',
          userId: 'user1',
          notebookId: 'notebook1',
          color: '#ffffff',
          isArchived: false,
          isPinned: true,
          createdAt: '2026-05-23T15:18:21.000Z',
          updatedAt: '2026-05-23T15:18:21.000Z',
        },
      ];
      cacheService.get.mockReturnValue(null);
      db.all.mockReturnValue(mockNotes);

      const result = await service.findAll('user1', { includeArchived: false });

      expect(db.select).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalled();
      expect(result[0].id).toBe('1');
    });

    it('should query DB filtering by folderId on cache miss', async () => {
      const mockNotes = [
        {
          id: '2',
          title: 'Folder Note',
          content: 'This is in a folder',
          userId: 'user1',
          notebookId: 'notebook1',
          color: '#ffffff',
          isArchived: false,
          isPinned: false,
          createdAt: '2026-05-23T15:18:21.000Z',
          updatedAt: '2026-05-23T15:18:21.000Z',
        },
      ];
      cacheService.get.mockReturnValue(null);
      db.all.mockReturnValue(mockNotes);

      const result = await service.findAll('user1', {
        includeArchived: false,
        folderId: 'folder1',
      });

      expect(db.select).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalledWith(
        'user:user1:notes:archived:false:nb::folder:folder1:pin::q::tags:',
        expect.any(Array),
        60_000,
      );
      expect(result[0].id).toBe('2');
    });
  });

  describe('findOne', () => {
    it('should return cached note on cache hit', async () => {
      const cached = { id: '1', title: 'Hit', content: 'x', userId: 'user1' };
      cacheService.get.mockReturnValue(cached);

      const result = await service.findOne('1', 'user1');

      expect(result).toBe(cached);
      expect(db.select).not.toHaveBeenCalled();
    });

    it('should query DB and cache the result on cache miss', async () => {
      const mockNote = {
        id: '1',
        title: 'Miss',
        content: 'y',
        userId: 'user1',
        notebookId: null,
        color: '#ffffff',
        isArchived: false,
        isPinned: false,
        createdAt: '2026-05-23T15:00:00.000Z',
        updatedAt: '2026-05-23T15:00:00.000Z',
      };
      cacheService.get.mockReturnValue(null);
      db.all.mockReturnValue([mockNote]);

      const result = await service.findOne('1', 'user1');

      expect(db.select).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalledWith(
        'note:1:user:user1',
        expect.any(Object),
        60_000,
      );
      expect(result.id).toBe('1');
    });
  });

  describe('create', () => {
    it('should create a note and invalidate the list cache', async () => {
      const mockNote = {
        id: '1',
        title: 'New Note',
        content: 'Content',
        userId: 'user1',
        notebookId: 'notebook1',
        color: '#ffffff',
        isArchived: false,
        isPinned: true,
        createdAt: '2026-05-23T15:18:21.000Z',
        updatedAt: '2026-05-23T15:18:21.000Z',
      };
      db.all.mockReturnValue([mockNote]);

      await service.create(
        {
          title: 'New Note',
          content: 'Content',
          notebookId: 'notebook1',
          isPinned: true,
          tagIds: ['tag1'],
        },
        'user1',
      );

      expect(db.insert).toHaveBeenCalled();
      expect(tagsService.setNoteTags).toHaveBeenCalledWith(
        '1',
        ['tag1'],
        'user1',
      );
      expect(cacheService.clearPattern).toHaveBeenCalledWith(
        'user:user1:notes:*',
      );
    });
  });

  describe('update', () => {
    it('should create a revision, update DB, and invalidate caches', async () => {
      const mockCurrentNote = {
        id: '1',
        title: 'Original',
        content: 'Old',
        userId: 'user1',
        color: '#ffffff',
        isArchived: false,
        isPinned: false,
        createdAt: '2026-05-23T15:00:00.000Z',
        updatedAt: '2026-05-23T15:00:00.000Z',
      };
      const mockUpdated = { ...mockCurrentNote, title: 'Updated' };

      db.all
        .mockReturnValueOnce([mockCurrentNote])
        .mockReturnValueOnce([mockUpdated]);

      await service.update({ id: '1', title: 'Updated' }, 'user1');

      expect(noteRevisionsService.createRevision).toHaveBeenCalledWith(
        '1',
        'Original',
        'Old',
      );
      expect(cacheService.delete).toHaveBeenCalledWith('note:1:user:user1');
      expect(cacheService.clearPattern).toHaveBeenCalledWith(
        'user:user1:notes:*',
      );
    });
  });

  describe('remove', () => {
    it('should delete note and invalidate its caches', async () => {
      const mockNote = {
        id: '1',
        title: 'To Delete',
        content: 'bye',
        userId: 'user1',
        notebookId: null,
        color: '#ffffff',
        isArchived: false,
        isPinned: false,
        createdAt: '2026-05-23T15:00:00.000Z',
        updatedAt: '2026-05-23T15:00:00.000Z',
      };
      db.all.mockReturnValue([mockNote]);

      const result = await service.remove('1', 'user1');

      expect(result).toBe(true);
      expect(db.delete).toHaveBeenCalled();
      expect(cacheService.delete).toHaveBeenCalledWith('note:1:user:user1');
      expect(cacheService.clearPattern).toHaveBeenCalledWith(
        'user:user1:notes:*',
      );
    });
  });

  describe('restoreRevision', () => {
    it('should restore note and invalidate caches', async () => {
      const mockRevision = {
        id: 'rev1',
        noteId: '1',
        title: 'Restored Title',
        content: 'Restored Body',
        createdAt: '2026-05-23T15:00:00.000Z',
      };
      const mockCurrentNote = {
        id: '1',
        title: 'Current',
        content: 'Now',
        userId: 'user1',
        color: '#ffffff',
        isArchived: false,
        isPinned: false,
        createdAt: '2026-05-23T15:00:00.000Z',
        updatedAt: '2026-05-23T15:00:00.000Z',
      };
      const mockRestoredNote = {
        ...mockCurrentNote,
        title: 'Restored Title',
        content: 'Restored Body',
      };

      noteRevisionsService.findOne.mockResolvedValue(mockRevision);
      db.all
        .mockReturnValueOnce([mockCurrentNote])
        .mockReturnValueOnce([mockRestoredNote]);

      await service.restoreRevision('rev1', 'user1');

      expect(noteRevisionsService.createRevision).toHaveBeenCalledWith(
        '1',
        'Current',
        'Now',
      );
      expect(cacheService.delete).toHaveBeenCalledWith('note:1:user:user1');
      expect(cacheService.clearPattern).toHaveBeenCalledWith(
        'user:user1:notes:*',
      );
    });
  });
});
