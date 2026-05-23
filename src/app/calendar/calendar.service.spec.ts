import { Test, TestingModule } from '@nestjs/testing';
import { CalendarService } from './calendar.service';
import { DRIZZLE } from '../../drizzle/drizzle.provider';
import { CacheService } from '../../cache/cache.service';
import { EventsPubSubService } from '../../events/events-pub-sub.service';
import { BadRequestException } from '@nestjs/common';

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: () => 'event-1',
}));

describe('CalendarService', () => {
  let service: CalendarService;
  let db: {
    select: jest.Mock;
    from: jest.Mock;
    where: jest.Mock;
    all: jest.Mock;
    insert: jest.Mock;
    values: jest.Mock;
    run: jest.Mock;
  };

  beforeEach(async () => {
    db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      all: jest.fn().mockReturnValue([]),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      run: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        { provide: DRIZZLE, useValue: db },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn().mockReturnValue(null),
            set: jest.fn(),
            delete: jest.fn(),
            clearPattern: jest.fn(),
          },
        },
        {
          provide: EventsPubSubService,
          useValue: { publishCalendarEvent: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(CalendarService);
  });

  it('rejects endAt before startAt', async () => {
    await expect(
      service.create(
        {
          title: 'Meet',
          startAt: '2026-05-23T14:00:00.000Z',
          endAt: '2026-05-23T10:00:00.000Z',
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
