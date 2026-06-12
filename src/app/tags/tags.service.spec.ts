import { Test, TestingModule } from '@nestjs/testing';
import { TagsService } from './tags.service';
import { DRIZZLE } from '../../drizzle/drizzle.provider';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { NotebooksService } from '../notebooks/notebooks.service';
import { CacheService } from '../../cache/cache.service';

describe('TagsService', () => {
  let service: TagsService;
  let db: any;

  beforeEach(async () => {
    db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
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
        TagsService,
        {
          provide: DRIZZLE,
          useValue: db,
        },
        {
          provide: NotebooksService,
          useValue: { findOne: jest.fn().mockResolvedValue({ id: 'nb1' }) },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn().mockReturnValue(null),
            set: jest.fn(),
            delete: jest.fn(),
            clearPattern: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TagsService>(TagsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all tags for a user', async () => {
      const mockTags = [
        {
          id: '1',
          name: 'important',
          color: '#808080',
          userId: 'user1',
          notebookId: null,
          sortOrder: 0,
          createdAt: '2026-05-23T15:32:37.000Z',
        },
      ];
      db.orderBy.mockReturnThis();
      db.all
        .mockReturnValueOnce(mockTags)
        .mockReturnValueOnce([{ count: 2 }]);

      const result = await service.findAll('user1');
      expect(result).toHaveLength(1);
      expect(result[0].noteCount).toBe(2);
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should throw BadRequestException if tag name already exists', async () => {
      db.all.mockReturnValue([
        {
          id: '1',
          name: 'existing',
          color: '#808080',
          userId: 'user1',
          notebookId: null,
          sortOrder: 0,
          createdAt: '2026-05-23T15:32:37.000Z',
        },
      ]);
      await expect(
        service.create({ name: 'Existing', color: '#808080' }, 'user1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create tag successfully', async () => {
      const mockTag = {
        id: '2',
        name: 'newtag',
        color: '#808080',
        userId: 'user1',
        notebookId: null,
        sortOrder: 0,
        createdAt: '2026-05-23T15:32:37.000Z',
      };
      db.all
        .mockReturnValueOnce([])
        .mockReturnValueOnce([{ max: 0 }])
        .mockReturnValueOnce([mockTag])
        .mockReturnValueOnce([{ count: 0 }]);

      const result = await service.create(
        { name: 'NewTag', color: '#808080' },
        'user1',
      );
      expect(result.name).toBe('newtag');
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when missing', async () => {
      db.all.mockReturnValue([]);
      await expect(service.findOne('x', 'user1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
