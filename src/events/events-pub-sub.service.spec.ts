import { Test, TestingModule } from '@nestjs/testing';
import { EventsPubSubService } from './events-pub-sub.service';
import { AppEventAction } from './app-event-action.enum';

describe('EventsPubSubService', () => {
  let service: EventsPubSubService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventsPubSubService],
    }).compile();

    service = module.get(EventsPubSubService);
  });

  it('publishes notification and app event', async () => {
    const received: unknown[] = [];
    const iterator = service.notificationIterator('user-1');
    const consume = (async () => {
      for await (const payload of iterator) {
        received.push(payload);
        break;
      }
    })();

    await service.publishNotification('user-1', {
      id: 'n1',
      userId: 'user-1',
      type: 'NOTE_SHARED',
      message: 'Hello',
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    await consume;
    expect(received[0]).toMatchObject({
      notificationAdded: { id: 'n1' },
    });
  });

  it('filters app events by user channel', async () => {
    const iterator = service.appEventIterator('user-2');
    const consume = (async () => {
      for await (const payload of iterator) {
        expect(payload.appEvent.action).toBe(AppEventAction.NOTE_CREATED);
        return;
      }
    })();

    await service.publishNoteEvent('user-2', AppEventAction.NOTE_CREATED, {
      id: 'note-1',
      title: 'T',
      content: 'C',
      userId: 'user-2',
      color: '#fff',
      isArchived: false,
      isPinned: false,
      createdAt: '',
      updatedAt: '',
    });

    await consume;
  });
});
