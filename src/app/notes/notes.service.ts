import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DRIZZLE } from '../../drizzle/drizzle.provider';
import type { DrizzleDB } from '../../drizzle/drizzle.provider';
import { notes } from '../../drizzle/schema';
import { eq, and, or, like, desc, exists, inArray } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { CreateNoteInput, UpdateNoteInput } from './note.dto';
import { Note } from './note.model';
import * as crypto from 'crypto';
import { TagsService } from '../tags/tags.service';
import { NoteRevisionsService } from './note-revisions.service';
import { notesToTags, notebooks, noteShares } from '../../drizzle/schema';
import { CacheService } from '../../cache/cache.service';
import { UsersService } from '../../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsPubSubService } from '../../events/events-pub-sub.service';
import { AppEventAction } from '../../events/app-event-action.enum';

const NOTE_TTL_MS = 60_000; // 60 seconds

export type DbNote = typeof notes.$inferSelect;

export function mapDbNoteToModel(dbNote: DbNote): Note {
  return {
    id: dbNote.id,
    title: dbNote.title,
    content: dbNote.content,
    userId: dbNote.userId,
    notebookId: dbNote.notebookId ?? undefined,
    color: dbNote.color,
    isArchived: dbNote.isArchived,
    isPinned: dbNote.isPinned,
    createdAt: dbNote.createdAt,
    updatedAt: dbNote.updatedAt,
  };
}

@Injectable()
export class NotesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly tagsService: TagsService,
    private readonly noteRevisionsService: NoteRevisionsService,
    private readonly cacheService: CacheService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly eventsPubSub: EventsPubSubService,
  ) {}

  private buildListKey(
    userId: string,
    options: {
      includeArchived: boolean;
      onlyArchived?: boolean;
      notebookId?: string;
      folderId?: string;
      isPinned?: boolean;
      searchQuery?: string;
      tagIds?: string[];
    },
  ): string {
    return [
      `user:${userId}:notes`,
      `archived:${options.includeArchived}`,
      `onlyArchived:${options.onlyArchived ?? false}`,
      `nb:${options.notebookId ?? ''}`,
      `folder:${options.folderId ?? ''}`,
      `pin:${options.isPinned ?? ''}`,
      `q:${options.searchQuery ?? ''}`,
      `tags:${(options.tagIds ?? []).sort().join(',')}`,
    ].join(':');
  }

  private async invalidateNoteCaches(
    noteId: string,
    ownerId: string,
  ): Promise<void> {
    // 1. Invalidate owner's caches
    this.cacheService.delete(`note:${noteId}:user:${ownerId}`);
    this.cacheService.clearPattern(`user:${ownerId}:notes:*`);

    // 2. Fetch shared users
    const shares = this.db
      .select({ userId: noteShares.sharedWithUserId })
      .from(noteShares)
      .where(eq(noteShares.noteId, noteId))
      .all();

    // 3. Invalidate each shared user's caches
    for (const share of shares) {
      this.cacheService.delete(`note:${noteId}:user:${share.userId}`);
      this.cacheService.clearPattern(`user:${share.userId}:notes:*`);
    }
  }

  async findAll(
    userId: string,
    optionsOrIncludeArchived?:
      | boolean
      | {
          includeArchived?: boolean;
          onlyArchived?: boolean;
          notebookId?: string;
          folderId?: string;
          isPinned?: boolean;
          searchQuery?: string;
          tagIds?: string[];
        },
  ): Promise<Note[]> {
    let includeArchived = false;
    let onlyArchived = false;
    let notebookId: string | undefined;
    let folderId: string | undefined;
    let isPinned: boolean | undefined;
    let searchQuery: string | undefined;
    let tagIds: string[] | undefined;

    if (typeof optionsOrIncludeArchived === 'boolean') {
      includeArchived = optionsOrIncludeArchived;
    } else if (optionsOrIncludeArchived) {
      includeArchived = optionsOrIncludeArchived.includeArchived ?? false;
      onlyArchived = optionsOrIncludeArchived.onlyArchived ?? false;
      notebookId = optionsOrIncludeArchived.notebookId;
      folderId = optionsOrIncludeArchived.folderId;
      isPinned = optionsOrIncludeArchived.isPinned;
      searchQuery = optionsOrIncludeArchived.searchQuery;
      tagIds = optionsOrIncludeArchived.tagIds;
    }

    const cacheKey = this.buildListKey(userId, {
      includeArchived,
      onlyArchived,
      notebookId,
      folderId,
      isPinned,
      searchQuery,
      tagIds,
    });

    const cached = this.cacheService.get<Note[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Accessible notes: owned by user OR shared with user
    const conditions: SQL<unknown>[] = [];

    const accessCondition = or(
      eq(notes.userId, userId),
      exists(
        this.db
          .select()
          .from(noteShares)
          .where(
            and(
              eq(noteShares.noteId, notes.id),
              eq(noteShares.sharedWithUserId, userId),
            ),
          ),
      ),
    );

    if (accessCondition) {
      conditions.push(accessCondition);
    }

    if (onlyArchived) {
      conditions.push(eq(notes.isArchived, true));
    } else if (!includeArchived) {
      conditions.push(eq(notes.isArchived, false));
    }

    if (notebookId !== undefined) {
      conditions.push(eq(notes.notebookId, notebookId));
    }

    if (folderId !== undefined) {
      conditions.push(
        exists(
          this.db
            .select()
            .from(notebooks)
            .where(
              and(
                eq(notebooks.id, notes.notebookId),
                eq(notebooks.folderId, folderId),
              ),
            ),
        ),
      );
    }

    if (isPinned !== undefined) {
      conditions.push(eq(notes.isPinned, isPinned));
    }

    if (searchQuery) {
      const likePattern = `%${searchQuery}%`;
      const searchCondition = or(
        like(notes.title, likePattern),
        like(notes.content, likePattern),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    if (tagIds && tagIds.length > 0) {
      conditions.push(
        exists(
          this.db
            .select()
            .from(notesToTags)
            .where(
              and(
                eq(notesToTags.noteId, notes.id),
                inArray(notesToTags.tagId, tagIds),
              ),
            ),
        ),
      );
    }

    const rows = this.db
      .select()
      .from(notes)
      .where(and(...conditions))
      .orderBy(desc(notes.isPinned), desc(notes.updatedAt))
      .all();

    const result = rows.map(mapDbNoteToModel);
    this.cacheService.set(cacheKey, result, NOTE_TTL_MS);
    return result;
  }

  async findOne(id: string, userId: string): Promise<Note> {
    const cacheKey = `note:${id}:user:${userId}`;
    const cached = this.cacheService.get<Note>(cacheKey);
    if (cached) {
      return cached;
    }

    const results = this.db.select().from(notes).where(eq(notes.id, id)).all();

    const note = results[0];
    if (!note) {
      throw new NotFoundException(`Note with ID "${id}" not found.`);
    }

    // Check ownership or shared access
    let hasAccess = note.userId === userId;
    if (!hasAccess) {
      const shareResults = this.db
        .select()
        .from(noteShares)
        .where(
          and(
            eq(noteShares.noteId, id),
            eq(noteShares.sharedWithUserId, userId),
          ),
        )
        .all();
      if (shareResults.length > 0) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      throw new NotFoundException(`Note with ID "${id}" not found.`);
    }

    const model = mapDbNoteToModel(note);
    this.cacheService.set(cacheKey, model, NOTE_TTL_MS);
    return model;
  }

  async create(input: CreateNoteInput, userId: string): Promise<Note> {
    const id = crypto.randomUUID();
    const { tagIds, ...noteData } = input;
    const newNote = {
      id,
      title: noteData.title,
      content: noteData.content,
      userId,
      notebookId: noteData.notebookId ?? null,
      color: noteData.color ?? '#ffffff',
      isArchived: false,
      isPinned: noteData.isPinned ?? false,
    };

    this.db.insert(notes).values(newNote).run();

    if (tagIds && tagIds.length > 0) {
      await this.tagsService.setNoteTags(id, tagIds, userId);
    }

    // Invalidate the note list for this user
    this.cacheService.clearPattern(`user:${userId}:notes:*`);

    const note = await this.findOne(id, userId);
    await this.eventsPubSub.publishNoteEvent(
      userId,
      AppEventAction.NOTE_CREATED,
      note,
    );
    return note;
  }

  async update(input: UpdateNoteInput, userId: string): Promise<Note> {
    const { id, tagIds, ...updateData } = input;

    // Ensure the note exists and belongs to this user / shared with this user
    const currentNote = await this.findOne(id, userId);

    // Verify write permissions (either owner or WRITE share permission)
    let hasWriteAccess = currentNote.userId === userId;
    if (!hasWriteAccess) {
      const shareResults = this.db
        .select()
        .from(noteShares)
        .where(
          and(
            eq(noteShares.noteId, id),
            eq(noteShares.sharedWithUserId, userId),
            eq(noteShares.permission, 'WRITE'),
          ),
        )
        .all();
      if (shareResults.length === 0) {
        throw new ForbiddenException(
          `You do not have write access to this note.`,
        );
      }
    }

    // Create a revision of the current note state before applying the updates
    await this.noteRevisionsService.createRevision(
      currentNote.id,
      currentNote.title,
      currentNote.content,
    );

    // Clean undefined fields to avoid overwriting with null
    const cleanedData = Object.fromEntries(
      Object.entries(updateData).filter(([_, v]) => v !== undefined),
    );

    // Force refresh the update timestamp
    cleanedData.updatedAt = new Date().toISOString();

    this.db.update(notes).set(cleanedData).where(eq(notes.id, id)).run();

    if (tagIds !== undefined) {
      await this.tagsService.setNoteTags(id, tagIds, currentNote.userId);
    }

    // Invalidate stale caches for owner and shared users
    await this.invalidateNoteCaches(id, currentNote.userId);

    const note = await this.findOne(id, userId);
    const recipients = await this.getNoteCollaboratorUserIds(id, currentNote.userId);
    await this.eventsPubSub.broadcastNoteEvent(
      recipients,
      AppEventAction.NOTE_UPDATED,
      note,
      userId,
    );
    return note;
  }

  private async getNoteCollaboratorUserIds(
    noteId: string,
    ownerId: string,
  ): Promise<string[]> {
    const shares = this.db
      .select({ userId: noteShares.sharedWithUserId })
      .from(noteShares)
      .where(eq(noteShares.noteId, noteId))
      .all();
    return [ownerId, ...shares.map((s) => s.userId)];
  }

  async restoreRevision(revisionId: string, userId: string): Promise<Note> {
    const revision = await this.noteRevisionsService.findOne(
      revisionId,
      userId,
    );
    const currentNote = await this.findOne(revision.noteId, userId);

    // Verify write permissions (either owner or WRITE share permission)
    let hasWriteAccess = currentNote.userId === userId;
    if (!hasWriteAccess) {
      const shareResults = this.db
        .select()
        .from(noteShares)
        .where(
          and(
            eq(noteShares.noteId, revision.noteId),
            eq(noteShares.sharedWithUserId, userId),
            eq(noteShares.permission, 'WRITE'),
          ),
        )
        .all();
      if (shareResults.length === 0) {
        throw new ForbiddenException(
          `You do not have write access to this note.`,
        );
      }
    }

    // Create a revision of the current note state before overwriting it
    await this.noteRevisionsService.createRevision(
      currentNote.id,
      currentNote.title,
      currentNote.content,
    );

    this.db
      .update(notes)
      .set({
        title: revision.title,
        content: revision.content,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(notes.id, revision.noteId))
      .run();

    // Invalidate stale caches
    await this.invalidateNoteCaches(revision.noteId, currentNote.userId);

    return this.findOne(revision.noteId, userId);
  }

  async remove(id: string, userId: string): Promise<boolean> {
    // Ensure the note exists and user has access
    const note = await this.findOne(id, userId);

    // Only owner can delete notes
    if (note.userId !== userId) {
      throw new ForbiddenException(`Only the owner can delete this note.`);
    }

    // Capture shared user IDs before deletion so we can invalidate their caches
    const shares = this.db
      .select({ userId: noteShares.sharedWithUserId })
      .from(noteShares)
      .where(eq(noteShares.noteId, id))
      .all();

    await this.eventsPubSub.publishNoteEvent(
      userId,
      AppEventAction.NOTE_DELETED,
      note,
    );

    this.db.delete(notes).where(eq(notes.id, id)).run();

    // Invalidate caches
    this.cacheService.delete(`note:${id}:user:${userId}`);
    this.cacheService.clearPattern(`user:${userId}:notes:*`);

    for (const share of shares) {
      this.cacheService.delete(`note:${id}:user:${share.userId}`);
      this.cacheService.clearPattern(`user:${share.userId}:notes:*`);
    }

    return true;
  }

  async emptyTrash(userId: string): Promise<number> {
    const archived = await this.findAll(userId, { onlyArchived: true });
    let deleted = 0;

    for (const note of archived) {
      if (note.userId !== userId) {
        continue;
      }
      await this.remove(note.id, userId);
      deleted += 1;
    }

    return deleted;
  }

  async shareNote(
    noteId: string,
    sharedWithEmail: string,
    permission: 'READ' | 'WRITE',
    userId: string,
  ): Promise<any> {
    // 1. Ensure note exists and caller is owner
    const note = await this.findOne(noteId, userId);
    if (note.userId !== userId) {
      throw new ForbiddenException('Only the owner can share this note.');
    }

    // 2. Find recipient user by email
    const recipient = await this.usersService.findByEmail(sharedWithEmail);
    if (!recipient) {
      throw new NotFoundException(
        `User with email "${sharedWithEmail}" not found.`,
      );
    }

    if (recipient.id === userId) {
      throw new ForbiddenException('You cannot share a note with yourself.');
    }

    // 3. Check if already shared
    const existingShares = this.db
      .select()
      .from(noteShares)
      .where(
        and(
          eq(noteShares.noteId, noteId),
          eq(noteShares.sharedWithUserId, recipient.id),
        ),
      )
      .all();

    const existingShare = existingShares[0];
    let shareId: string;

    if (existingShare) {
      shareId = existingShare.id;
      this.db
        .update(noteShares)
        .set({ permission })
        .where(eq(noteShares.id, shareId))
        .run();
    } else {
      shareId = crypto.randomUUID();
      this.db
        .insert(noteShares)
        .values({
          id: shareId,
          noteId,
          sharedWithUserId: recipient.id,
          permission,
        })
        .run();
    }

    // 4. Create notification for recipient
    const ownerName = await this.usersService
      .findOne(userId)
      .then((u) => u.name);
    await this.notificationsService.create(
      recipient.id,
      'NOTE_SHARED',
      `${ownerName} shared the note "${note.title}" with you.`,
      {
        noteId,
        noteTitle: note.title,
        ownerUserId: userId,
        ownerName,
      },
    );

    const sharedNote = await this.findOne(noteId, recipient.id);
    const recipients = await this.getNoteCollaboratorUserIds(noteId, note.userId);
    await this.eventsPubSub.broadcastNoteEvent(
      recipients,
      AppEventAction.NOTE_SHARED,
      sharedNote,
      userId,
    );

    // 5. Invalidate recipient note list caches and note detail cache
    this.cacheService.clearPattern(`user:${recipient.id}:notes:*`);
    this.cacheService.delete(`note:${noteId}:user:${recipient.id}`);

    // Retrieve and return the created/updated share
    const results = this.db
      .select()
      .from(noteShares)
      .where(eq(noteShares.id, shareId))
      .all();

    return results[0];
  }

  async unshareNote(
    noteId: string,
    sharedWithUserId: string,
    userId: string,
  ): Promise<boolean> {
    // Ensure note exists
    const note = await this.findOne(noteId, userId);

    // Caller must be the owner of the note OR the recipient removing themselves
    const isOwner = note.userId === userId;
    const isRecipient = sharedWithUserId === userId;

    if (!isOwner && !isRecipient) {
      throw new ForbiddenException(
        'You do not have permission to modify sharing for this note.',
      );
    }

    // Perform delete
    this.db
      .delete(noteShares)
      .where(
        and(
          eq(noteShares.noteId, noteId),
          eq(noteShares.sharedWithUserId, sharedWithUserId),
        ),
      )
      .run();

    // Invalidate caches
    this.cacheService.clearPattern(`user:${sharedWithUserId}:notes:*`);
    this.cacheService.delete(`note:${noteId}:user:${sharedWithUserId}`);

    return true;
  }

  async findSharesForNote(noteId: string, userId: string): Promise<any[]> {
    // Only note owner can view sharing settings
    const note = await this.findOne(noteId, userId);
    if (note.userId !== userId) {
      throw new ForbiddenException('Only the owner can view sharing settings.');
    }

    return this.db
      .select()
      .from(noteShares)
      .where(eq(noteShares.noteId, noteId))
      .all();
  }
}
