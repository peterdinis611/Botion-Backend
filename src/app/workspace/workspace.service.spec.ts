import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceService } from './workspace.service';
import { NotesService } from '../notes/notes.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  const notificationsService = { create: jest.fn().mockResolvedValue({}) };
  const notesService = {
    findOne: jest.fn().mockResolvedValue({
      id: 'note-1',
      title: 'Quick Notes',
      userId: 'user-1',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        { provide: NotesService, useValue: notesService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(WorkspaceService);
    jest.clearAllMocks();
  });

  it('inviteMember creates a notification', async () => {
    const result = await service.inviteMember('user-1', {
      email: 'peer@example.com',
    });

    expect(result.success).toBe(true);
    expect(notificationsService.create).toHaveBeenCalledWith(
      'user-1',
      'WORKSPACE_INVITE',
      expect.stringContaining('peer@example.com'),
    );
  });

  it('buildPageShareLink returns note path', async () => {
    const link = await service.buildPageShareLink('user-1', 'note-1');
    expect(link.path).toBe('/workspace/notes/note-1');
    expect(link.title).toBe('Quick Notes');
  });
});
