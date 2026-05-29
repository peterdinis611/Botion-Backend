import {
  Args,
  ID,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../../auth/gql-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { JwtPayload } from '../../auth/current-user.decorator';
import { Snap } from './snap.model';
import { SnapsService } from './snaps.service';
import {
  CreateSnapInput,
  SnapListScope,
  UpdateSnapInput,
} from './snap.dto';

@Resolver(() => Snap)
@UseGuards(GqlAuthGuard)
export class SnapsResolver {
  constructor(private readonly snapsService: SnapsService) {}

  @Query(() => [Snap], { name: 'snaps' })
  async getSnaps(
    @CurrentUser() currentUser: JwtPayload,
    @Args('scope', { type: () => SnapListScope, nullable: true })
    scope?: SnapListScope,
    @Args('notebookId', { type: () => ID, nullable: true })
    notebookId?: string,
    @Args('noteId', { type: () => ID, nullable: true })
    noteId?: string,
  ) {
    return this.snapsService.findAll(currentUser.sub, {
      scope: scope ?? SnapListScope.ALL,
      notebookId,
      noteId,
    });
  }

  @Query(() => Snap, { name: 'snap' })
  async getSnap(
    @CurrentUser() currentUser: JwtPayload,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.snapsService.findOne(id, currentUser.sub);
  }

  @Mutation(() => Snap)
  async createSnap(
    @CurrentUser() currentUser: JwtPayload,
    @Args('input') input: CreateSnapInput,
  ) {
    return this.snapsService.create(input, currentUser.sub);
  }

  @Mutation(() => Snap)
  async updateSnap(
    @CurrentUser() currentUser: JwtPayload,
    @Args('input') input: UpdateSnapInput,
  ) {
    return this.snapsService.update(input, currentUser.sub);
  }

  @Mutation(() => [Snap])
  async reorderSnaps(
    @CurrentUser() currentUser: JwtPayload,
    @Args('ids', { type: () => [ID] }) ids: string[],
  ) {
    return this.snapsService.reorder(ids, currentUser.sub);
  }

  @Mutation(() => Boolean)
  async removeSnap(
    @CurrentUser() currentUser: JwtPayload,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.snapsService.remove(id, currentUser.sub);
  }
}
