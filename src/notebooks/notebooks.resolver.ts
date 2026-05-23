import { Resolver, Query, Mutation, Args, ResolveField, Parent, ID } from '@nestjs/graphql';
import { NotebooksService } from './notebooks.service';
import { Notebook } from './notebook.model';
import { CreateNotebookInput, UpdateNotebookInput } from './notebook.dto';
import { User } from '../users/user.model';
import { UsersService } from '../users/users.service';
import { Note } from '../notes/note.model';
import { NotesService } from '../notes/notes.service';
import { UseGuards, Inject, forwardRef } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/current-user.decorator';
import { Folder } from '../folders/folder.model';
import { FoldersService } from '../folders/folders.service';

@Resolver(() => Notebook)
@UseGuards(GqlAuthGuard)
export class NotebooksResolver {
  constructor(
    private readonly notebooksService: NotebooksService,
    private readonly usersService: UsersService,
    private readonly notesService: NotesService,
    @Inject(forwardRef(() => FoldersService))
    private readonly foldersService: FoldersService,
  ) {}

  @Query(() => [Notebook], { name: 'notebooks' })
  async getNotebooks(@CurrentUser() currentUser: JwtPayload) {
    return this.notebooksService.findAll(currentUser.sub);
  }

  @Query(() => Notebook, { name: 'notebook' })
  async getNotebook(
    @CurrentUser() currentUser: JwtPayload,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.notebooksService.findOne(id, currentUser.sub);
  }

  @Mutation(() => Notebook)
  async createNotebook(
    @CurrentUser() currentUser: JwtPayload,
    @Args('input') input: CreateNotebookInput,
  ) {
    return this.notebooksService.create(input, currentUser.sub);
  }

  @Mutation(() => Notebook)
  async updateNotebook(
    @CurrentUser() currentUser: JwtPayload,
    @Args('input') input: UpdateNotebookInput,
  ) {
    return this.notebooksService.update(input, currentUser.sub);
  }

  @Mutation(() => Boolean)
  async removeNotebook(
    @CurrentUser() currentUser: JwtPayload,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.notebooksService.remove(id, currentUser.sub);
  }

  @ResolveField(() => User)
  async user(@Parent() notebook: Notebook) {
    return this.usersService.findOne(notebook.userId);
  }

  @ResolveField(() => [Note])
  async notes(@Parent() notebook: Notebook) {
    // Return all notes for this notebook, including archived ones
    return this.notesService.findAll(notebook.userId, {
      includeArchived: true,
      notebookId: notebook.id,
    });
  }

  @ResolveField(() => Folder, { nullable: true })
  async folder(@Parent() notebook: Notebook) {
    if (!notebook.folderId) {
      return null;
    }
    return this.foldersService.findOne(notebook.folderId, notebook.userId);
  }
}
