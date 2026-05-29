import { BadRequestException, Injectable } from '@nestjs/common';
import { NotesService } from '../notes/notes.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InviteWorkspaceMemberInput } from './workspace.dto';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly notesService: NotesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async inviteMember(
    userId: string,
    input: InviteWorkspaceMemberInput,
  ): Promise<{ success: boolean; message: string }> {
    const email = input.email.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Email is required.');
    }

    const custom = input.message?.trim();
    const message = custom
      ? `Invitation sent to ${email}: ${custom}`
      : `Invitation sent to ${email}. They will receive an email to join your workspace.`;

    await this.notificationsService.create(userId, 'WORKSPACE_INVITE', message);

    return { success: true, message };
  }

  async buildPageShareLink(
    userId: string,
    noteId: string,
  ): Promise<{ path: string; title: string }> {
    const note = await this.notesService.findOne(noteId, userId);
    return {
      path: `/workspace/notes/${note.id}`,
      title: note.title || 'Untitled',
    };
  }

  async resolveSharePath(
    userId: string,
    path: string,
  ): Promise<{ path: string; title: string }> {
    const match = path.match(/\/workspace\/notes\/([^/?]+)/);
    if (!match) {
      throw new BadRequestException('Invalid share path for a workspace page.');
    }
    return this.buildPageShareLink(userId, match[1]);
  }
}
