import { Test, TestingModule } from '@nestjs/testing';
import { NoteRevisionsService } from './note-revisions.service';
import { DRIZZLE } from '../../drizzle/drizzle.provider';
import { NotFoundException } from '@nestjs/common';

describe('NoteRevisionsService', () => {
  let service: NoteRevisionsService;
  let db: any;

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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NoteRevisionsService,
        {
          provide: DRIZZLE,
          useValue: db,
        },
      ],
    }).compile();

    service = module.get<NoteRevisionsService>(NoteRevisionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllForNote', () => {
    it('should return all revisions for a note', async () => {
      const mockRevisions = [
        {
          id: '1',
          noteId: 'note1',
          title: 'V1',
          content: 'Body V1',
          createdAt: '2026-05-23T15:32:37.000Z',
        },
      ];
      db.all.mockReturnValue(mockRevisions);

      const result = await service.findAllForNote('note1', 'user1');
      expect(result).toEqual(mockRevisions);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if revision does not exist', async () => {
      db.all.mockReturnValue([]);
      await expect(service.findOne('invalid', 'user1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return the revision if found', async () => {
      const mockRevision = {
        id: '1',
        noteId: 'note1',
        title: 'V1',
        content: 'Body V1',
        createdAt: '2026-05-23T15:32:37.000Z',
      };
      db.all.mockReturnValue([mockRevision]);

      const result = await service.findOne('1', 'user1');
      expect(result).toEqual(mockRevision);
    });
  });
});
