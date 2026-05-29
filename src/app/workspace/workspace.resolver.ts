import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../../auth/gql-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { JwtPayload } from '../../auth/current-user.decorator';
import { NoteShare } from '../notes/note-share.model';
import { WorkspaceCollaborator } from './workspace-collaborator.model';
import {
  InviteWorkspaceMemberInput,
  InviteWorkspaceMemberResult,
  PageShareLink,
  SharePageInput,
} from './workspace.dto';
import { WorkspaceService } from './workspace.service';

@Resolver()
@UseGuards(GqlAuthGuard)
export class WorkspaceResolver {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Mutation(() => InviteWorkspaceMemberResult)
  async inviteWorkspaceMember(
    @CurrentUser() currentUser: JwtPayload,
    @Args('input') input: InviteWorkspaceMemberInput,
  ) {
    return this.workspaceService.inviteMember(currentUser.sub, input);
  }

  @Query(() => PageShareLink, { name: 'pageShareLink' })
  async getPageShareLink(
    @CurrentUser() currentUser: JwtPayload,
    @Args('noteId', { type: () => ID }) noteId: string,
  ) {
    return this.workspaceService.buildPageShareLink(currentUser.sub, noteId);
  }

  @Query(() => PageShareLink, { name: 'resolvePageShare' })
  async resolvePageShare(
    @CurrentUser() currentUser: JwtPayload,
    @Args('path') path: string,
  ) {
    return this.workspaceService.resolveSharePath(currentUser.sub, path);
  }

  @Query(() => [WorkspaceCollaborator], { name: 'workspaceCollaborators' })
  async workspaceCollaborators(
    @CurrentUser() currentUser: JwtPayload,
    @Args('noteId', { type: () => ID, nullable: true }) noteId?: string,
  ) {
    return this.workspaceService.listCollaborators(currentUser.sub, noteId);
  }

  @Mutation(() => NoteShare)
  async sharePageWithCollaborator(
    @CurrentUser() currentUser: JwtPayload,
    @Args('input') input: SharePageInput,
  ) {
    if (!input.noteId) {
      throw new BadRequestException('noteId is required to share a page.');
    }
    return this.workspaceService.sharePageWithCollaborator(
      currentUser.sub,
      input.email,
      input.noteId,
    );
  }
}
