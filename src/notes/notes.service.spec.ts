import { Test, TestingModule } from '@nestjs/testing';
import { NotesService } from './notes.service';
import { DRIZZLE } from '../drizzle/drizzle.provider';
import { TagsService } from '../tags/tags.service';
import { NoteRevisionsService } from './note-revisions.service';
import { NotFoundException } from '@nestjs/common';
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        {
          provide: DRIZZLE,
          useValue: db,
        },
        {
          provide: TagsService,
          useValue: tagsService,
        },
        {
          provide: NoteRevisionsService,
          useValue: noteRevisionsService,
        },
      ],
    }).compile();

    service = module.get<NotesService>(NotesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return notes for a user sorted and filtered', async () => {
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
      db.all.mockReturnValue(mockNotes);

      const result = await service.findAll('user1', {
        includeArchived: false,
        notebookId: 'notebook1',
        isPinned: true,
      });

      expect(result).toEqual(mockNotes);
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create a note with notebookId, isPinned, and tagIds', async () => {
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

      const result = await service.create(
        {
          title: 'New Note',
          content: 'Content',
          notebookId: 'notebook1',
          isPinned: true,
          tagIds: ['tag1', 'tag2'],
        },
        'user1',
      );

      expect(result).toEqual(mockNote);
      expect(db.insert).toHaveBeenCalled();
      expect(tagsService.setNoteTags).toHaveBeenCalledWith('1', ['tag1', 'tag2'], 'user1');
    });
  });

  describe('update', () => {
    it('should create a revision of the current note before updating', async () => {
      const mockCurrentNote = {
        id: '1',
        title: 'Original Title',
        content: 'Original Content',
        userId: 'user1',
        color: '#ffffff',
        isArchived: false,
        isPinned: false,
        createdAt: '2026-05-23T15:18:21.000Z',
        updatedAt: '2026-05-23T15:18:21.000Z',
      };

      const mockUpdatedNote = {
        ...mockCurrentNote,
        title: 'Updated Title',
      };

      // Mock findOne: returns mockCurrentNote the first time (when getting current state),
      // and mockUpdatedNote the second time (when returning the updated state).
      db.all
        .mockReturnValueOnce([mockCurrentNote]) // current note retrieval
        .mockReturnValueOnce([mockUpdatedNote]); // updated note retrieval

      const result = await service.update(
        {
          id: '1',
          title: 'Updated Title',
        },
        'user1',
      );

      expect(result).toEqual(mockUpdatedNote);
      expect(noteRevisionsService.createRevision).toHaveBeenCalledWith(
        '1',
        'Original Title',
        'Original Content',
      );
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('restoreRevision', () => {
    it('should restore note to previous revision and create a revision of current state', async () => {
      const mockRevision = {
        id: 'rev1',
        noteId: '1',
        title: 'Revision Title',
        content: 'Revision Content',
        createdAt: '2026-05-23T15:18:21.000Z',
      };

      const mockCurrentNote = {
        id: '1',
        title: 'Current Overwritten Title',
        content: 'Current Overwritten Content',
        userId: 'user1',
        color: '#ffffff',
        isArchived: false,
        isPinned: false,
        createdAt: '2026-05-23T15:18:21.000Z',
        updatedAt: '2026-05-23T15:18:21.000Z',
      };

      const mockRestoredNote = {
        ...mockCurrentNote,
        title: 'Revision Title',
        content: 'Revision Content',
      };

      noteRevisionsService.findOne.mockResolvedValue(mockRevision);
      
      // Mock findOne (for currentNote and restoredNote)
      db.all
        .mockReturnValueOnce([mockCurrentNote]) // current state
        .mockReturnValueOnce([mockRestoredNote]); // restored state

      const result = await service.restoreRevision('rev1', 'user1');

      expect(result).toEqual(mockRestoredNote);
      expect(noteRevisionsService.createRevision).toHaveBeenCalledWith(
        '1',
        'Current Overwritten Title',
        'Current Overwritten Content',
      );
      expect(db.update).toHaveBeenCalled();
    });
  });
});
