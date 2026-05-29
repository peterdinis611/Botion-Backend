import {
  Resolver,
  Query,
  Mutation,
  Args,
  ResolveField,
  Parent,
  ID,
  Int,
} from '@nestjs/graphql';
import { NotesService } from './notes.service';
import { Note } from './note.model';
import {
  CreateNoteInput,
  UpdateNoteInput,
  ShareNoteInput,
  UnshareNoteInput,
} from './note.dto';
import { NoteShare } from './note-share.model';
import { User } from '../../users/user.model';
import { UsersService } from '../../users/users.service';
import { UseGuards, Inject, forwardRef } from '@nestjs/common';
import { GqlAuthGuard } from '../../auth/gql-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { JwtPayload } from '../../auth/current-user.decorator';
import { Notebook } from '../notebooks/notebook.model';
import { NotebooksService } from '../notebooks/notebooks.service';
import { Tag } from '../tags/tag.model';
import { TagsService } from '../tags/tags.service';
import { NoteRevision } from './note-revision.model';
import { NoteRevisionsService } from './note-revisions.service';

@Resolver(() => Note)
@UseGuards(GqlAuthGuard)
export class NotesResolver {
  constructor(
    private readonly notesService: NotesService,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => NotebooksService))
    private readonly notebooksService: NotebooksService,
    private readonly tagsService: TagsService,
    private readonly noteRevisionsService: NoteRevisionsService,
  ) {}

  @Query(() => [Note], { name: 'notes' })
  async getNotes(
    @CurrentUser() currentUser: JwtPayload,
    @Args('includeArchived', {
      type: () => Boolean,
      nullable: true,
      defaultValue: false,
    })
    includeArchived: boolean,
    @Args('onlyArchived', {
      type: () => Boolean,
      nullable: true,
      defaultValue: false,
    })
    onlyArchived: boolean,
    @Args('notebookId', { type: () => ID, nullable: true })
    notebookId?: string,
    @Args('folderId', { type: () => ID, nullable: true })
    folderId?: string,
    @Args('isPinned', { type: () => Boolean, nullable: true })
    isPinned?: boolean,
    @Args('searchQuery', { type: () => String, nullable: true })
    searchQuery?: string,
    @Args('tagIds', { type: () => [String], nullable: true })
    tagIds?: string[],
  ) {
    return this.notesService.findAll(currentUser.sub, {
      includeArchived,
      onlyArchived,
      notebookId,
      folderId,
      isPinned,
      searchQuery,
      tagIds,
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

  @Mutation(() => Note)
  async restoreNoteRevision(
    @CurrentUser() currentUser: JwtPayload,
    @Args('revisionId', { type: () => ID }) revisionId: string,
  ) {
    return this.notesService.restoreRevision(revisionId, currentUser.sub);
  }

  @Mutation(() => Boolean)
  async removeNote(
    @CurrentUser() currentUser: JwtPayload,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.notesService.remove(id, currentUser.sub);
  }

  @Mutation(() => Int, { name: 'emptyTrash' })
  async emptyTrash(@CurrentUser() currentUser: JwtPayload) {
    return this.notesService.emptyTrash(currentUser.sub);
  }

  // ─── Sharing ─────────────────────────────────────────────────────────────────

  @Query(() => [NoteShare], { name: 'noteShares' })
  async getNoteShares(
    @CurrentUser() currentUser: JwtPayload,
    @Args('noteId', { type: () => ID }) noteId: string,
  ) {
    return this.notesService.findSharesForNote(noteId, currentUser.sub);
  }

  @Mutation(() => NoteShare)
  async shareNote(
    @CurrentUser() currentUser: JwtPayload,
    @Args('input') input: ShareNoteInput,
  ) {
    return this.notesService.shareNote(
      input.noteId,
      input.sharedWithEmail,
      input.permission,
      currentUser.sub,
    );
  }

  @Mutation(() => Boolean)
  async unshareNote(
    @CurrentUser() currentUser: JwtPayload,
    @Args('input') input: UnshareNoteInput,
  ) {
    return this.notesService.unshareNote(
      input.noteId,
      input.sharedWithUserId,
      currentUser.sub,
    );
  }

  // ─── Resolved Fields ──────────────────────────────────────────────────────────

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

  @ResolveField(() => [Tag])
  async tags(@Parent() note: Note) {
    return this.tagsService.findTagsForNote(note.id);
  }

  @ResolveField(() => [NoteRevision])
  async revisions(@Parent() note: Note) {
    return this.noteRevisionsService.findAllForNote(note.id, note.userId);
  }
}
