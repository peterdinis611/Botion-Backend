import {
  Resolver,
  Query,
  Mutation,
  Args,
  ResolveField,
  Parent,
  ID,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GraphsService } from './graphs.service';
import { Graph } from './graph.model';
import { CreateGraphInput, UpdateGraphInput } from './graph.dto';
import { User } from '../../users/user.model';
import { UsersService } from '../../users/users.service';
import { GqlAuthGuard } from '../../auth/gql-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { JwtPayload } from '../../auth/current-user.decorator';

@Resolver(() => Graph)
@UseGuards(GqlAuthGuard)
export class GraphsResolver {
  constructor(
    private readonly graphsService: GraphsService,
    private readonly usersService: UsersService,
  ) {}

  @Query(() => [Graph], { name: 'graphs' })
  async getGraphs(@CurrentUser() currentUser: JwtPayload) {
    return this.graphsService.findAll(currentUser.sub);
  }

  @Query(() => Graph, { name: 'graph' })
  async getGraph(
    @CurrentUser() currentUser: JwtPayload,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.graphsService.findOne(id, currentUser.sub);
  }

  @Mutation(() => Graph)
  async createGraph(
    @CurrentUser() currentUser: JwtPayload,
    @Args('input') input: CreateGraphInput,
  ) {
    return this.graphsService.create(input, currentUser.sub);
  }

  @Mutation(() => Graph)
  async updateGraph(
    @CurrentUser() currentUser: JwtPayload,
    @Args('input') input: UpdateGraphInput,
  ) {
    return this.graphsService.update(input, currentUser.sub);
  }

  @Mutation(() => Boolean)
  async removeGraph(
    @CurrentUser() currentUser: JwtPayload,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.graphsService.remove(id, currentUser.sub);
  }

  @ResolveField(() => User)
  async user(@Parent() graph: Graph) {
    return this.usersService.findOne(graph.userId);
  }
}
