import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UsersService } from './users.service';
import { User } from './user.model';
import { CreateUserInput, UpdateUserInput } from './user.dto';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Resolver(() => User)
export class UsersResolver {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Query(() => User, { name: 'me', nullable: true })
  @UseGuards(GqlAuthGuard)
  async getMe(@CurrentUser() currentUser: any) {
    return this.usersService.findOne(currentUser.sub);
  }

  @Query(() => [User], { name: 'users' })
  @UseGuards(GqlAuthGuard)
  async getUsers() {
    return this.usersService.findAll();
  }

  @Query(() => User, { name: 'user', nullable: true })
  async getUser(@Args('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Mutation(() => User)
  async createUser(@Args('input') input: CreateUserInput) {
    return this.usersService.create(input);
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async updateUser(@Args('input') input: UpdateUserInput) {
    return this.usersService.update(input);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async removeUser(@Args('id') id: string) {
    return this.usersService.remove(id);
  }
}
