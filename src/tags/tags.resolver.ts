import {
  Resolver,
  Query,
  Mutation,
  Args,
  ResolveField,
  Parent,
  ID,
} from '@nestjs/graphql';
import { TagsService } from './tags.service';
import { Tag } from './tag.model';
import { CreateTagInput, UpdateTagInput } from './tag.dto';
import { User } from '../users/user.model';
import { UsersService } from '../users/users.service';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/current-user.decorator';

@Resolver(() => Tag)
@UseGuards(GqlAuthGuard)
export class TagsResolver {
  constructor(
    private readonly tagsService: TagsService,
    private readonly usersService: UsersService,
  ) {}

  @Query(() => [Tag], { name: 'tags' })
  async getTags(@CurrentUser() currentUser: JwtPayload) {
    return this.tagsService.findAll(currentUser.sub);
  }

  @Mutation(() => Tag)
  async createTag(
    @CurrentUser() currentUser: JwtPayload,
    @Args('input') input: CreateTagInput,
  ) {
    return this.tagsService.create(input, currentUser.sub);
  }

  @Mutation(() => Tag)
  async updateTag(
    @CurrentUser() currentUser: JwtPayload,
    @Args('input') input: UpdateTagInput,
  ) {
    return this.tagsService.update(input, currentUser.sub);
  }

  @Mutation(() => Boolean)
  async removeTag(
    @CurrentUser() currentUser: JwtPayload,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.tagsService.remove(id, currentUser.sub);
  }

  @ResolveField(() => User)
  async user(@Parent() tag: Tag) {
    return this.usersService.findOne(tag.userId);
  }
}
