import { Test, TestingModule } from '@nestjs/testing';
import { NotebooksService } from './notebooks.service';
import { DRIZZLE } from '../drizzle/drizzle.provider';
import { NotFoundException } from '@nestjs/common';

describe('NotebooksService', () => {
  let service: NotebooksService;
  let db: any;

  beforeEach(async () => {
    db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
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
        NotebooksService,
        {
          provide: DRIZZLE,
          useValue: db,
        },
      ],
    }).compile();

    service = module.get<NotebooksService>(NotebooksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all notebooks for a user', async () => {
      const mockNotebooks = [
        {
          id: '1',
          name: 'Work',
          color: '#ffffff',
          userId: 'user1',
          createdAt: '2026-05-23T15:18:21.000Z',
          updatedAt: '2026-05-23T15:18:21.000Z',
        },
      ];
      db.all.mockReturnValue(mockNotebooks);

      const result = await service.findAll('user1');
      expect(result).toEqual(mockNotebooks);
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a notebook if found', async () => {
      const mockNotebook = {
        id: '1',
        name: 'Work',
        color: '#ffffff',
        userId: 'user1',
        createdAt: '2026-05-23T15:18:21.000Z',
        updatedAt: '2026-05-23T15:18:21.000Z',
      };
      db.all.mockReturnValue([mockNotebook]);

      const result = await service.findOne('1', 'user1');
      expect(result).toEqual(mockNotebook);
    });

    it('should throw NotFoundException if not found', async () => {
      db.all.mockReturnValue([]);
      await expect(service.findOne('1', 'user1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
