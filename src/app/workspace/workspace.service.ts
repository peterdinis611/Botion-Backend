import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import * as crypto from 'crypto';
import { DRIZZLE } from '../../drizzle/drizzle.provider';
import type { DrizzleDB } from '../../drizzle/drizzle.provider';
import {
  noteShares,
  notes,
  users,
  workspaceInvites,
} from '../../drizzle/schema';
import { NotesService } from '../notes/notes.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../../users/users.service';
import { InviteWorkspaceMemberInput } from './workspace.dto';
import {
  CollaboratorStatus,
  WorkspaceCollaborator,
} from './workspace-collaborator.model';

@Injectable()
export class WorkspaceService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly notesService: NotesService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  async inviteMember(
    userId: string,
    input: InviteWorkspaceMemberInput,
  ): Promise<{ success: boolean; message: string }> {
    const email = input.email.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Email is required.');
    }

    const owner = await this.usersService.findOne(userId);
    if (owner.email.toLowerCase() === email) {
      throw new BadRequestException('You cannot invite yourself.');
    }

    let invitedUser: Awaited<ReturnType<UsersService['findByEmail']>> | null =
      null;
    try {
      invitedUser = await this.usersService.findByEmail(email);
    } catch {
      invitedUser = null;
    }

    const existing = this.db
      .select()
      .from(workspaceInvites)
      .where(
        and(
          eq(workspaceInvites.ownerUserId, userId),
          eq(workspaceInvites.email, email),
        ),
      )
      .all()[0];

    let inviteId: string;

    if (existing) {
      inviteId = existing.id;
      this.db
        .update(workspaceInvites)
        .set({
          status: 'PENDING',
          message: input.message?.trim() || existing.message,
          invitedUserId: invitedUser?.id ?? existing.invitedUserId,
        })
        .where(eq(workspaceInvites.id, existing.id))
        .run();
    } else {
      inviteId = crypto.randomUUID();
      this.db
        .insert(workspaceInvites)
        .values({
          id: inviteId,
          ownerUserId: userId,
          email,
          invitedUserId: invitedUser?.id ?? null,
          status: 'PENDING',
          message: input.message?.trim() || null,
        })
        .run();
    }

    const custom = input.message?.trim();
    const message = custom
      ? `Invitation sent to ${email}: ${custom}`
      : `Invitation sent to ${email}. They will see it in your workspace header.`;

    await this.notificationsService.create(
      userId,
      'WORKSPACE_INVITE',
      message,
      { role: 'sent', inviteId, email },
    );

    if (invitedUser) {
      await this.notificationsService.create(
        invitedUser.id,
        'WORKSPACE_INVITE',
        `${owner.name} invited you to collaborate on Botion.`,
        {
          role: 'received',
          inviteId,
          ownerUserId: userId,
          ownerName: owner.name,
        },
      );
    }

    return { success: true, message };
  }

  async acceptWorkspaceInvite(
    userId: string,
    inviteId: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.usersService.findOne(userId);
    const rows = this.db
      .select()
      .from(workspaceInvites)
      .where(eq(workspaceInvites.id, inviteId))
      .all();
    const invite = rows[0];
    if (!invite) {
      throw new NotFoundException('Invitation not found.');
    }

    const isRecipient =
      invite.invitedUserId === userId ||
      invite.email.toLowerCase() === user.email.toLowerCase();

    if (!isRecipient) {
      throw new ForbiddenException('This invitation is not for your account.');
    }

    if (invite.status === 'ACCEPTED') {
      return { success: true, message: 'Invitation already accepted.' };
    }

    this.db
      .update(workspaceInvites)
      .set({
        status: 'ACCEPTED',
        invitedUserId: userId,
      })
      .where(eq(workspaceInvites.id, inviteId))
      .run();

    const owner = await this.usersService.findOne(invite.ownerUserId);

    await this.notificationsService.create(
      invite.ownerUserId,
      'WORKSPACE_INVITE',
      `${user.name} accepted your workspace invitation.`,
      { role: 'accepted', inviteId, memberUserId: userId },
    );

    await this.notificationsService.create(
      userId,
      'WORKSPACE_INVITE',
      `You joined ${owner.name}'s workspace on Botion.`,
      { role: 'accepted', inviteId, ownerUserId: invite.ownerUserId },
    );

    return {
      success: true,
      message: `You are now connected with ${owner.name}'s workspace.`,
    };
  }

  async listCollaborators(
    userId: string,
    noteId?: string,
  ): Promise<WorkspaceCollaborator[]> {
    const self = await this.usersService.findOne(userId);
    const map = new Map<string, WorkspaceCollaborator>();

    map.set(self.id, {
      id: self.id,
      name: self.name,
      email: self.email,
      status: CollaboratorStatus.SELF,
    });

    const invites = this.db
      .select()
      .from(workspaceInvites)
      .where(eq(workspaceInvites.ownerUserId, userId))
      .all();

    for (const invite of invites) {
      if (invite.status === 'ACCEPTED' && invite.invitedUserId) {
        try {
          const u = await this.usersService.findOne(invite.invitedUserId);
          map.set(u.id, {
            id: u.id,
            name: u.name,
            email: u.email,
            status: CollaboratorStatus.MEMBER,
          });
        } catch {
          // skip
        }
        continue;
      }

      if (invite.status !== 'PENDING') continue;
      const key = invite.invitedUserId ?? `pending:${invite.email}`;
      if (map.has(key)) continue;

      if (invite.invitedUserId) {
        try {
          const u = await this.usersService.findOne(invite.invitedUserId);
          map.set(u.id, {
            id: u.id,
            name: u.name,
            email: u.email,
            status: CollaboratorStatus.PENDING_INVITE,
          });
        } catch {
          map.set(key, {
            id: key,
            name: invite.email.split('@')[0],
            email: invite.email,
            status: CollaboratorStatus.PENDING_INVITE,
          });
        }
      } else {
        map.set(key, {
          id: key,
          name: invite.email.split('@')[0],
          email: invite.email,
          status: CollaboratorStatus.PENDING_INVITE,
        });
      }
    }

    const ownedNoteIds = this.db
      .select({ id: notes.id })
      .from(notes)
      .where(eq(notes.userId, userId))
      .all()
      .map((n) => n.id);

    if (ownedNoteIds.length > 0) {
      const shares = this.db
        .select()
        .from(noteShares)
        .where(inArray(noteShares.noteId, ownedNoteIds))
        .all();

      for (const share of shares) {
        if (map.has(share.sharedWithUserId)) continue;
        try {
          const u = await this.usersService.findOne(share.sharedWithUserId);
          map.set(u.id, {
            id: u.id,
            name: u.name,
            email: u.email,
            status: CollaboratorStatus.MEMBER,
            permission: share.permission,
          });
        } catch {
          // skip missing user
        }
      }
    }

    if (noteId) {
      try {
        const note = await this.notesService.findOne(noteId, userId);
        const shares = this.db
          .select()
          .from(noteShares)
          .where(eq(noteShares.noteId, noteId))
          .all();

        for (const share of shares) {
          if (share.sharedWithUserId === userId) continue;
          try {
            const u = await this.usersService.findOne(share.sharedWithUserId);
            map.set(u.id, {
              id: u.id,
              name: u.name,
              email: u.email,
              status: CollaboratorStatus.NOTE_COLLABORATOR,
              permission: share.permission,
              noteId: note.id,
            });
          } catch {
            // skip
          }
        }

        if (note.userId !== userId) {
          try {
            const owner = await this.usersService.findOne(note.userId);
            if (!map.has(owner.id)) {
              map.set(owner.id, {
                id: owner.id,
                name: owner.name,
                email: owner.email,
                status: CollaboratorStatus.NOTE_COLLABORATOR,
                permission: 'WRITE',
                noteId: note.id,
              });
            }
          } catch {
            // skip
          }
        }
      } catch {
        // note not accessible
      }
    }

    return [...map.values()];
  }

  async sharePageWithCollaborator(
    userId: string,
    email: string,
    noteId: string,
  ) {
    return this.notesService.shareNote(noteId, email, 'WRITE', userId);
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
