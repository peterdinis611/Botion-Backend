import { Test, TestingModule } from '@nestjs/testing';
import { NotebooksService } from './notebooks.service';
import { DRIZZLE } from '../../drizzle/drizzle.provider';
import { CacheService } from '../../cache/cache.service';
import { NotFoundException } from '@nestjs/common';

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: () => '1',
}));

describe('NotebooksService', () => {
  let service: NotebooksService;
  let db: any;
  let cacheService: any;

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

    cacheService = {
      get: jest.fn().mockReturnValue(null),
      set: jest.fn(),
      delete: jest.fn(),
      clearPattern: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotebooksService,
        { provide: DRIZZLE, useValue: db },
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get<NotebooksService>(NotebooksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return cached result on cache hit without querying the DB', async () => {
      const cached = [
        {
          id: '1',
          name: 'Cached Notebook',
          color: '#ffffff',
          userId: 'user1',
          folderId: 'folder1',
        },
      ];
      cacheService.get.mockReturnValue(cached);

      const result = await service.findAll('user1');

      expect(result).toBe(cached);
      expect(db.select).not.toHaveBeenCalled();
      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('should query DB and populate cache on cache miss', async () => {
      const mockNotebooks = [
        {
          id: '1',
          name: 'Work',
          color: '#ffffff',
          userId: 'user1',
          folderId: 'folder1',
          createdAt: '2026-05-23T15:18:21.000Z',
          updatedAt: '2026-05-23T15:18:21.000Z',
        },
      ];
      cacheService.get.mockReturnValue(null);
      db.all.mockReturnValue(mockNotebooks);

      const result = await service.findAll('user1');

      expect(db.select).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalledWith(
        'user:user1:notebooks',
        expect.any(Array),
        180_000,
      );
      expect(result).toEqual(mockNotebooks);
    });
  });

  describe('findOne', () => {
    it('should return cached notebook on cache hit', async () => {
      const cached = {
        id: '1',
        name: 'Cached',
        color: '#ffffff',
        userId: 'user1',
        folderId: 'folder1',
      };
      cacheService.get.mockReturnValue(cached);

      const result = await service.findOne('1', 'user1');

      expect(result).toBe(cached);
      expect(db.select).not.toHaveBeenCalled();
    });

    it('should query DB and cache the result on cache miss', async () => {
      const mockNotebook = {
        id: '1',
        name: 'Work',
        color: '#ffffff',
        userId: 'user1',
        folderId: 'folder1',
        createdAt: '2026-05-23T15:18:21.000Z',
        updatedAt: '2026-05-23T15:18:21.000Z',
      };
      cacheService.get.mockReturnValue(null);
      db.all.mockReturnValue([mockNotebook]);

      const result = await service.findOne('1', 'user1');

      expect(db.select).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalledWith(
        'notebook:1:user:user1',
        expect.any(Object),
        180_000,
      );
      expect(result).toEqual(mockNotebook);
    });

    it('should throw NotFoundException if not found in DB on cache miss', async () => {
      cacheService.get.mockReturnValue(null);
      db.all.mockReturnValue([]);

      await expect(service.findOne('1', 'user1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a notebook, invalidate list and folder caches, and return the notebook', async () => {
      const mockNotebook = {
        id: '1',
        name: 'New Notebook',
        color: '#ff0000',
        userId: 'user1',
        folderId: 'folder1',
        createdAt: '2026-05-23T15:18:21.000Z',
        updatedAt: '2026-05-23T15:18:21.000Z',
      };
      db.all.mockReturnValue([mockNotebook]);

      const result = await service.create(
        { name: 'New Notebook', color: '#ff0000', folderId: 'folder1' },
        'user1',
      );

      expect(db.insert).toHaveBeenCalled();
      expect(cacheService.delete).toHaveBeenCalledWith('user:user1:notebooks');
      expect(cacheService.delete).toHaveBeenCalledWith(
        'folder:folder1:user:user1',
      );
      expect(result).toEqual(mockNotebook);
    });
  });

  describe('update', () => {
    it('should update notebook, invalidate caches, and return updated notebook', async () => {
      const mockCurrent = {
        id: '1',
        name: 'Original Name',
        color: '#ffffff',
        userId: 'user1',
        folderId: 'folder_old',
        createdAt: '2026-05-23T15:00:00.000Z',
        updatedAt: '2026-05-23T15:00:00.000Z',
      };
      const mockUpdated = {
        ...mockCurrent,
        name: 'Updated Name',
        folderId: 'folder_new',
      };

      // First findOne (check existence) returns original via cache hit
      // Second findOne (return updated) returns updated via DB mock on cache miss (since delete was called)
      cacheService.get
        .mockReturnValueOnce(mockCurrent)
        .mockReturnValueOnce(null);
      db.all.mockReturnValue([mockUpdated]);

      const result = await service.update(
        { id: '1', name: 'Updated Name', folderId: 'folder_new' },
        'user1',
      );

      expect(db.update).toHaveBeenCalled();
      expect(cacheService.delete).toHaveBeenCalledWith('notebook:1:user:user1');
      expect(cacheService.delete).toHaveBeenCalledWith('user:user1:notebooks');
      expect(cacheService.delete).toHaveBeenCalledWith(
        'folder:folder_new:user:user1',
      );
      expect(cacheService.delete).toHaveBeenCalledWith(
        'folder:folder_old:user:user1',
      );
      expect(cacheService.delete).toHaveBeenCalledWith('user:user1:folders');
      expect(cacheService.clearPattern).toHaveBeenCalledWith(
        'user:user1:notes:*',
      );
      expect(result).toEqual(mockUpdated);
    });
  });

  describe('remove', () => {
    it('should delete notebook and invalidate its caches', async () => {
      const mockNotebook = {
        id: '1',
        name: 'To Delete',
        color: '#ffffff',
        userId: 'user1',
        folderId: 'folder1',
        createdAt: '2026-05-23T15:00:00.000Z',
        updatedAt: '2026-05-23T15:00:00.000Z',
      };
      cacheService.get.mockReturnValue(mockNotebook);

      const result = await service.remove('1', 'user1');

      expect(result).toBe(true);
      expect(db.delete).toHaveBeenCalled();
      expect(cacheService.delete).toHaveBeenCalledWith('notebook:1:user:user1');
      expect(cacheService.delete).toHaveBeenCalledWith('user:user1:notebooks');
      expect(cacheService.delete).toHaveBeenCalledWith(
        'folder:folder1:user:user1',
      );
      expect(cacheService.clearPattern).toHaveBeenCalledWith(
        'user:user1:notes:*',
      );
    });
  });
});
