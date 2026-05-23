import { Test, TestingModule } from '@nestjs/testing';
import { FoldersService } from './folders.service';
import { DRIZZLE } from '../../drizzle/drizzle.provider';
import { CacheService } from '../../cache/cache.service';
import { NotebooksService } from '../notebooks/notebooks.service';
import { NotFoundException } from '@nestjs/common';

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: () => '1',
}));

describe('FoldersService', () => {
  let service: FoldersService;
  let db: any;
  let cacheService: any;
  let notebooksService: any;

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

    notebooksService = {
      findOne: jest.fn(),
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoldersService,
        { provide: DRIZZLE, useValue: db },
        { provide: CacheService, useValue: cacheService },
        { provide: NotebooksService, useValue: notebooksService },
      ],
    }).compile();

    service = module.get<FoldersService>(FoldersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return cached folders on cache hit', async () => {
      const cached = [
        { id: '1', name: 'Cached Folder', color: '#ffffff', userId: 'user1' },
      ];
      cacheService.get.mockReturnValue(cached);

      const result = await service.findAll('user1');

      expect(result).toBe(cached);
      expect(db.select).not.toHaveBeenCalled();
    });

    it('should query DB and cache results on cache miss', async () => {
      const mockFolders = [
        {
          id: '1',
          name: 'Personal',
          color: '#ffffff',
          userId: 'user1',
          createdAt: '2026-05-23T15:00:00.000Z',
          updatedAt: '2026-05-23T15:00:00.000Z',
        },
      ];
      db.all.mockReturnValue(mockFolders);

      const result = await service.findAll('user1');

      expect(db.select).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalledWith(
        'user:user1:folders',
        expect.any(Array),
        60_000,
      );
      expect(result).toEqual(mockFolders);
    });
  });

  describe('findOne', () => {
    it('should return cached folder on cache hit', async () => {
      const cached = {
        id: '1',
        name: 'Personal',
        color: '#ffffff',
        userId: 'user1',
      };
      cacheService.get.mockReturnValue(cached);

      const result = await service.findOne('1', 'user1');

      expect(result).toBe(cached);
      expect(db.select).not.toHaveBeenCalled();
    });

    it('should query DB and cache on cache miss', async () => {
      const mockFolder = {
        id: '1',
        name: 'Personal',
        color: '#ffffff',
        userId: 'user1',
        createdAt: '2026-05-23T15:00:00.000Z',
        updatedAt: '2026-05-23T15:00:00.000Z',
      };
      db.all.mockReturnValue([mockFolder]);

      const result = await service.findOne('1', 'user1');

      expect(db.select).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalledWith(
        'folder:1:user:user1',
        expect.any(Object),
        60_000,
      );
      expect(result).toEqual(mockFolder);
    });

    it('should throw NotFoundException if folder not found in DB', async () => {
      db.all.mockReturnValue([]);

      await expect(service.findOne('1', 'user1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a folder, invalidate listing cache, and return details', async () => {
      const createdFolder = {
        id: '1',
        name: 'New Folder',
        color: '#ff0000',
        userId: 'user1',
        createdAt: '2026-05-23T15:00:00.000Z',
        updatedAt: '2026-05-23T15:00:00.000Z',
      };
      db.all.mockReturnValue([createdFolder]);

      const result = await service.create(
        { name: 'New Folder', color: '#ff0000' },
        'user1',
      );

      expect(db.insert).toHaveBeenCalled();
      expect(cacheService.delete).toHaveBeenCalledWith('user:user1:folders');
      expect(result).toEqual(createdFolder);
    });
  });

  describe('update', () => {
    it('should update folder and invalidate caches', async () => {
      const mockCurrent = {
        id: '1',
        name: 'Old Name',
        color: '#ffffff',
        userId: 'user1',
      };
      const mockUpdated = {
        id: '1',
        name: 'New Name',
        color: '#ffffff',
        userId: 'user1',
      };

      // findOne first hit, then query DB for second findOne
      cacheService.get
        .mockReturnValueOnce(mockCurrent)
        .mockReturnValueOnce(null);
      db.all.mockReturnValue([mockUpdated]);

      const result = await service.update(
        { id: '1', name: 'New Name' },
        'user1',
      );

      expect(db.update).toHaveBeenCalled();
      expect(cacheService.delete).toHaveBeenCalledWith('folder:1:user:user1');
      expect(cacheService.delete).toHaveBeenCalledWith('user:user1:folders');
      expect(result).toEqual(mockUpdated);
    });
  });

  describe('remove', () => {
    it('should delete folder and invalidate caches (including cascade side-effects)', async () => {
      const mockFolder = {
        id: '1',
        name: 'To Delete',
        color: '#ffffff',
        userId: 'user1',
      };
      cacheService.get.mockReturnValue(mockFolder);

      const result = await service.remove('1', 'user1');

      expect(result).toBe(true);
      expect(db.delete).toHaveBeenCalled();
      expect(cacheService.delete).toHaveBeenCalledWith('folder:1:user:user1');
      expect(cacheService.delete).toHaveBeenCalledWith('user:user1:folders');
      expect(cacheService.delete).toHaveBeenCalledWith('user:user1:notebooks');
      expect(cacheService.clearPattern).toHaveBeenCalledWith(
        'notebook:*:user:user1',
      );
      expect(cacheService.clearPattern).toHaveBeenCalledWith(
        'user:user1:notes:*',
      );
    });
  });

  describe('moveNotebookToFolder', () => {
    it('should update notebook folderId and invalidate caches', async () => {
      const mockNotebook = {
        id: 'nb1',
        name: 'Notebook 1',
        userId: 'user1',
        folderId: 'folder_old',
      };
      const mockFolder = {
        id: 'folder_new',
        name: 'Folder New',
        userId: 'user1',
      };
      const mockUpdatedNotebook = { ...mockNotebook, folderId: 'folder_new' };

      notebooksService.findOne
        .mockResolvedValueOnce(mockNotebook)
        .mockResolvedValueOnce(mockUpdatedNotebook);

      // Mock finding target folder
      cacheService.get.mockReturnValueOnce(mockFolder);

      const result = await service.moveNotebookToFolder(
        'nb1',
        'folder_new',
        'user1',
      );

      expect(db.update).toHaveBeenCalled();
      expect(cacheService.delete).toHaveBeenCalledWith(
        'notebook:nb1:user:user1',
      );
      expect(cacheService.delete).toHaveBeenCalledWith('user:user1:notebooks');
      expect(cacheService.delete).toHaveBeenCalledWith('user:user1:folders');
      expect(cacheService.delete).toHaveBeenCalledWith(
        'folder:folder_new:user:user1',
      );
      expect(cacheService.delete).toHaveBeenCalledWith(
        'folder:folder_old:user:user1',
      );
      expect(cacheService.clearPattern).toHaveBeenCalledWith(
        'user:user1:notes:*',
      );
      expect(result).toEqual(mockUpdatedNotebook);
    });
  });
});
