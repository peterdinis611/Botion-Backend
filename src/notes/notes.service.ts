import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.provider';
import type { DrizzleDB } from '../drizzle/drizzle.provider';
import { notes } from '../drizzle/schema';
import { eq, and, or, like, desc, exists, inArray } from 'drizzle-orm';
import { CreateNoteInput, UpdateNoteInput } from './note.dto';
import { Note } from './note.model';
import * as crypto from 'crypto';
import { TagsService } from '../tags/tags.service';
import { NoteRevisionsService } from './note-revisions.service';
import { notesToTags } from '../drizzle/schema';
import { CacheService } from '../cache/cache.service';

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
  ) {}

  private buildListKey(
    userId: string,
    options: {
      includeArchived: boolean;
      notebookId?: string;
      isPinned?: boolean;
      searchQuery?: string;
      tagIds?: string[];
    },
  ): string {
    return [
      `user:${userId}:notes`,
      `archived:${options.includeArchived}`,
      `nb:${options.notebookId ?? ''}`,
      `pin:${options.isPinned ?? ''}`,
      `q:${options.searchQuery ?? ''}`,
      `tags:${(options.tagIds ?? []).sort().join(',')}`,
    ].join(':');
  }

  async findAll(
    userId: string,
    optionsOrIncludeArchived?:
      | boolean
      | {
          includeArchived?: boolean;
          notebookId?: string;
          isPinned?: boolean;
          searchQuery?: string;
          tagIds?: string[];
        },
  ): Promise<Note[]> {
    let includeArchived = false;
    let notebookId: string | undefined;
    let isPinned: boolean | undefined;
    let searchQuery: string | undefined;
    let tagIds: string[] | undefined;

    if (typeof optionsOrIncludeArchived === 'boolean') {
      includeArchived = optionsOrIncludeArchived;
    } else if (optionsOrIncludeArchived) {
      includeArchived = optionsOrIncludeArchived.includeArchived ?? false;
      notebookId = optionsOrIncludeArchived.notebookId;
      isPinned = optionsOrIncludeArchived.isPinned;
      searchQuery = optionsOrIncludeArchived.searchQuery;
      tagIds = optionsOrIncludeArchived.tagIds;
    }

    const cacheKey = this.buildListKey(userId, {
      includeArchived,
      notebookId,
      isPinned,
      searchQuery,
      tagIds,
    });

    const cached = this.cacheService.get<Note[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const conditions = [eq(notes.userId, userId)];

    if (!includeArchived) {
      conditions.push(eq(notes.isArchived, false));
    }

    if (notebookId !== undefined) {
      conditions.push(eq(notes.notebookId, notebookId));
    }

    if (isPinned !== undefined) {
      conditions.push(eq(notes.isPinned, isPinned));
    }

    if (searchQuery) {
      const likePattern = `%${searchQuery}%`;
      conditions.push(
        or(
          like(notes.title, likePattern),
          like(notes.content, likePattern),
        ),
      );
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

    const results = this.db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .all();

    const note = results[0];
    if (!note) {
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

    return this.findOne(id, userId);
  }

  async update(input: UpdateNoteInput, userId: string): Promise<Note> {
    const { id, tagIds, ...updateData } = input;

    // Ensure the note exists and belongs to this user
    const currentNote = await this.findOne(id, userId);

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

    this.db
      .update(notes)
      .set(cleanedData)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .run();

    if (tagIds !== undefined) {
      await this.tagsService.setNoteTags(id, tagIds, userId);
    }

    // Invalidate stale caches
    this.cacheService.delete(`note:${id}:user:${userId}`);
    this.cacheService.clearPattern(`user:${userId}:notes:*`);

    return this.findOne(id, userId);
  }

  async restoreRevision(revisionId: string, userId: string): Promise<Note> {
    const revision = await this.noteRevisionsService.findOne(revisionId, userId);
    const currentNote = await this.findOne(revision.noteId, userId);

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
      .where(and(eq(notes.id, revision.noteId), eq(notes.userId, userId)))
      .run();

    // Invalidate stale caches
    this.cacheService.delete(`note:${revision.noteId}:user:${userId}`);
    this.cacheService.clearPattern(`user:${userId}:notes:*`);

    return this.findOne(revision.noteId, userId);
  }

  async remove(id: string, userId: string): Promise<boolean> {
    // Ensure the note exists and belongs to this user
    await this.findOne(id, userId);

    this.db
      .delete(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .run();

    // Invalidate stale caches
    this.cacheService.delete(`note:${id}:user:${userId}`);
    this.cacheService.clearPattern(`user:${userId}:notes:*`);

    return true;
  }
}
