import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../../auth/gql-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { JwtPayload } from '../../auth/current-user.decorator';
import {
  InviteWorkspaceMemberInput,
  InviteWorkspaceMemberResult,
  PageShareLink,
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
}
