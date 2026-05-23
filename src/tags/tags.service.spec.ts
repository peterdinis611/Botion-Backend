import { Test, TestingModule } from '@nestjs/testing';
import { TagsService } from './tags.service';
import { DRIZZLE } from '../drizzle/drizzle.provider';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('TagsService', () => {
  let service: TagsService;
  let db: any;

  beforeEach(async () => {
    db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
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
          name: 'Important',
          color: '#808080',
          userId: 'user1',
          createdAt: '2026-05-23T15:32:37.000Z',
        },
      ];
      db.all.mockReturnValue(mockTags);

      const result = await service.findAll('user1');
      expect(result).toEqual(mockTags);
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should throw BadRequestException if tag name already exists', async () => {
      db.all.mockReturnValue([{ id: '1', name: 'Existing' }]);
      await expect(
        service.create({ name: 'Existing', color: '#808080' }, 'user1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create tag successfully', async () => {
      const mockTag = {
        id: '2',
        name: 'NewTag',
        color: '#808080',
        userId: 'user1',
        createdAt: '2026-05-23T15:32:37.000Z',
      };
      // First call is for checking existing tags (returns empty), second call is for findOne (returns the created tag)
      db.all.mockReturnValueOnce([]).mockReturnValueOnce([mockTag]);

      const result = await service.create({ name: 'NewTag', color: '#808080' }, 'user1');
      expect(result).toEqual(mockTag);
      expect(db.insert).toHaveBeenCalled();
    });
  });
});
