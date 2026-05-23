import { Resolver, Query, Mutation, Args, ResolveField, Parent, ID } from '@nestjs/graphql';
import { NotesService } from './notes.service';
import { Note } from './note.model';
import { CreateNoteInput, UpdateNoteInput } from './note.dto';
import { User } from '../users/user.model';
import { UsersService } from '../users/users.service';
import { UseGuards, Inject, forwardRef } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/current-user.decorator';
import { Notebook } from '../notebooks/notebook.model';
import { NotebooksService } from '../notebooks/notebooks.service';

@Resolver(() => Note)
@UseGuards(GqlAuthGuard)
export class NotesResolver {
  constructor(
    private readonly notesService: NotesService,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => NotebooksService))
    private readonly notebooksService: NotebooksService,
  ) {}

  @Query(() => [Note], { name: 'notes' })
  async getNotes(
    @CurrentUser() currentUser: JwtPayload,
    @Args('includeArchived', { type: () => Boolean, nullable: true, defaultValue: false })
    includeArchived: boolean,
    @Args('notebookId', { type: () => ID, nullable: true })
    notebookId?: string,
    @Args('isPinned', { type: () => Boolean, nullable: true })
    isPinned?: boolean,
    @Args('searchQuery', { type: () => String, nullable: true })
    searchQuery?: string,
  ) {
    return this.notesService.findAll(currentUser.sub, {
      includeArchived,
      notebookId,
      isPinned,
      searchQuery,
    });
  }

  @Query(() => Note, { name: 'note' })
  async getNote(
    @CurrentUser() currentUser: JwtPayload,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.notesService.findOne(id, currentUser.sub);
  }

  @Mutation(() => Note)
  async createNote(
    @CurrentUser() currentUser: JwtPayload,
    @Args('input') input: CreateNoteInput,
  ) {
    return this.notesService.create(input, currentUser.sub);
  }

  @Mutation(() => Note)
  async updateNote(
    @CurrentUser() currentUser: JwtPayload,
    @Args('input') input: UpdateNoteInput,
  ) {
    return this.notesService.update(input, currentUser.sub);
  }

  @Mutation(() => Boolean)
  async removeNote(
    @CurrentUser() currentUser: JwtPayload,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.notesService.remove(id, currentUser.sub);
  }

  @ResolveField(() => User)
  async user(@Parent() note: Note) {
    return this.usersService.findOne(note.userId);
  }

  @ResolveField(() => Notebook, { nullable: true })
  async notebook(@Parent() note: Note) {
    if (!note.notebookId) {
      return null;
    }
    return this.notebooksService.findOne(note.notebookId, note.userId);
  }
}
