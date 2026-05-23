import {
  Resolver,
  Query,
  Mutation,
  Args,
  ResolveField,
  Parent,
  ID,
} from '@nestjs/graphql';
import { FoldersService } from './folders.service';
import { Folder } from './folder.model';
import { CreateFolderInput, UpdateFolderInput } from './folder.dto';
import { User } from '../users/user.model';
import { UsersService } from '../users/users.service';
import { Notebook } from '../notebooks/notebook.model';
import { NotebooksService } from '../notebooks/notebooks.service';
import { UseGuards, Inject, forwardRef } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/current-user.decorator';

@Resolver(() => Folder)
@UseGuards(GqlAuthGuard)
export class FoldersResolver {
  constructor(
    private readonly foldersService: FoldersService,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => NotebooksService))
    private readonly notebooksService: NotebooksService,
  ) {}

  @Query(() => [Folder], { name: 'folders' })
  async getFolders(@CurrentUser() currentUser: JwtPayload) {
    return this.foldersService.findAll(currentUser.sub);
  }

  @Query(() => Folder, { name: 'folder' })
  async getFolder(
    @CurrentUser() currentUser: JwtPayload,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.foldersService.findOne(id, currentUser.sub);
  }

  @Mutation(() => Folder)
  async createFolder(
    @CurrentUser() currentUser: JwtPayload,
    @Args('input') input: CreateFolderInput,
  ) {
    return this.foldersService.create(input, currentUser.sub);
  }

  @Mutation(() => Folder)
  async updateFolder(
    @CurrentUser() currentUser: JwtPayload,
    @Args('input') input: UpdateFolderInput,
  ) {
    return this.foldersService.update(input, currentUser.sub);
  }

  @Mutation(() => Boolean)
  async removeFolder(
    @CurrentUser() currentUser: JwtPayload,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.foldersService.remove(id, currentUser.sub);
  }

  @Mutation(() => Notebook)
  async moveNotebookToFolder(
    @CurrentUser() currentUser: JwtPayload,
    @Args('notebookId', { type: () => ID }) notebookId: string,
    @Args('folderId', { type: () => ID, nullable: true }) folderId?: string,
  ) {
    return this.foldersService.moveNotebookToFolder(
      notebookId,
      folderId ?? null,
      currentUser.sub,
    );
  }

  @ResolveField(() => User)
  async user(@Parent() folder: Folder) {
    return this.usersService.findOne(folder.userId);
  }

  @ResolveField(() => [Notebook])
  async notebooks(@Parent() folder: Folder) {
    const allNotebooks = await this.notebooksService.findAll(folder.userId);
    return allNotebooks.filter((nb) => nb.folderId === folder.id);
  }
}
