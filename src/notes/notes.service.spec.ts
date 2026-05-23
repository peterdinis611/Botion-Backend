import { Test, TestingModule } from '@nestjs/testing';
import { NotesService } from './notes.service';
import { DRIZZLE } from '../drizzle/drizzle.provider';
import { NotFoundException } from '@nestjs/common';

describe('NotesService', () => {
  let service: NotesService;
  let db: any;

  beforeEach(async () => {
    db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        {
          provide: DRIZZLE,
          useValue: db,
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
        {
          id: '2',
          title: 'Normal Note',
          content: 'Normal body',
          userId: 'user1',
          notebookId: undefined,
          color: '#ffffff',
          isArchived: false,
          isPinned: false,
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
    it('should create a note with notebookId and isPinned', async () => {
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

      // Mock findOne (which is called inside create to return the created note)
      db.all.mockReturnValue([mockNote]);

      const result = await service.create(
        {
          title: 'New Note',
          content: 'Content',
          notebookId: 'notebook1',
          isPinned: true,
        },
        'user1',
      );

      expect(result).toEqual(mockNote);
      expect(db.insert).toHaveBeenCalled();
    });
  });
});
