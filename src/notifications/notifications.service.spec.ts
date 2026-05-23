import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { DRIZZLE } from '../drizzle/drizzle.provider';

// ─── helpers ──────────────────────────────────────────────────────────────────

const makeNotif = (overrides: Partial<Record<string, any>> = {}) => ({
  id: 'notif-1',
  userId: 'user-1',
  type: 'NOTE_SHARED',
  message: 'Alice shared "My Note" with you.',
  isRead: false,
  createdAt: new Date().toISOString(),
  ...overrides,
});

// ─── mock DB builder ──────────────────────────────────────────────────────────

const buildMockDb = () => {
  const runMock = jest.fn().mockReturnValue(undefined);
  const allMock = jest.fn().mockReturnValue([]);

  const queryBuilder = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    run: runMock,
    all: allMock,
  };

  const db = {
    select: jest.fn().mockReturnValue(queryBuilder),
    insert: jest.fn().mockReturnValue(queryBuilder),
    update: jest.fn().mockReturnValue(queryBuilder),
    _queryBuilder: queryBuilder,
  };

  return { db, queryBuilder, runMock, allMock };
};

// ─── tests ────────────────────────────────────────────────────────────────────

describe('NotificationsService', () => {
  let service: NotificationsService;
  let db: ReturnType<typeof buildMockDb>['db'];
  let queryBuilder: ReturnType<typeof buildMockDb>['queryBuilder'];
  let allMock: jest.Mock;

  beforeEach(async () => {
    const mocks = buildMockDb();
    db = mocks.db;
    queryBuilder = mocks.queryBuilder;
    allMock = mocks.allMock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: DRIZZLE, useValue: db },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns mapped notifications for a user', async () => {
      const notif = makeNotif();
      allMock.mockReturnValueOnce([notif]);

      const result = await service.findAll('user-1');

      expect(db.select).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: notif.id,
        userId: notif.userId,
        type: notif.type,
        message: notif.message,
        isRead: false,
      });
    });

    it('returns empty array when no notifications exist', async () => {
      allMock.mockReturnValueOnce([]);
      const result = await service.findAll('user-1');
      expect(result).toEqual([]);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('inserts and returns a new notification', async () => {
      const created = makeNotif({ id: 'notif-new' });
      // first call is insert (run), second call is select (all)
      allMock.mockReturnValueOnce([created]);

      const result = await service.create('user-1', 'NOTE_SHARED', 'You have a new share.');

      expect(db.insert).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        userId: 'user-1',
        type: 'NOTE_SHARED',
        message: 'You have a new share.',
        isRead: false,
      });
    });

    it('throws an error when insert returns nothing', async () => {
      allMock.mockReturnValueOnce([]); // select after insert returns nothing

      await expect(
        service.create('user-1', 'NOTE_SHARED', 'msg'),
      ).rejects.toThrow('Failed to create notification.');
    });
  });

  // ─── markAsRead ───────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('marks a notification as read and returns it', async () => {
      const notif = makeNotif({ isRead: false });
      allMock.mockReturnValueOnce([notif]); // select before update

      const result = await service.markAsRead('notif-1', 'user-1');

      expect(db.update).toHaveBeenCalledTimes(1);
      expect(result.isRead).toBe(true);
    });

    it('throws NotFoundException when notification does not exist', async () => {
      allMock.mockReturnValueOnce([]); // select returns nothing

      await expect(
        service.markAsRead('non-existent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for wrong user', async () => {
      // Simulate the DB returning nothing (user mismatch filtered at DB level)
      allMock.mockReturnValueOnce([]);

      await expect(
        service.markAsRead('notif-1', 'user-999'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── markAllAsRead ────────────────────────────────────────────────────────

  describe('markAllAsRead', () => {
    it('marks all notifications as read and returns true', async () => {
      const result = await service.markAllAsRead('user-1');

      expect(db.update).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });
  });
});
