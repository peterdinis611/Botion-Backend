import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.provider';
import type { DrizzleDB } from '../drizzle/drizzle.provider';
import { notes } from '../drizzle/schema';
import { eq, and, or, like, desc } from 'drizzle-orm';
import { CreateNoteInput, UpdateNoteInput } from './note.dto';
import { Note } from './note.model';
import * as crypto from 'crypto';

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
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(
    userId: string,
    optionsOrIncludeArchived?:
      | boolean
      | {
          includeArchived?: boolean;
          notebookId?: string;
          isPinned?: boolean;
          searchQuery?: string;
        },
  ): Promise<Note[]> {
    let includeArchived = false;
    let notebookId: string | undefined;
    let isPinned: boolean | undefined;
    let searchQuery: string | undefined;

    if (typeof optionsOrIncludeArchived === 'boolean') {
      includeArchived = optionsOrIncludeArchived;
    } else if (optionsOrIncludeArchived) {
      includeArchived = optionsOrIncludeArchived.includeArchived ?? false;
      notebookId = optionsOrIncludeArchived.notebookId;
      isPinned = optionsOrIncludeArchived.isPinned;
      searchQuery = optionsOrIncludeArchived.searchQuery;
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

    const rows = this.db
      .select()
      .from(notes)
      .where(and(...conditions))
      .orderBy(desc(notes.isPinned), desc(notes.updatedAt))
      .all();

    return rows.map(mapDbNoteToModel);
  }

  async findOne(id: string, userId: string): Promise<Note> {
    const results = this.db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .all();

    const note = results[0];
    if (!note) {
      throw new NotFoundException(`Note with ID "${id}" not found.`);
    }

    return mapDbNoteToModel(note);
  }

  async create(input: CreateNoteInput, userId: string): Promise<Note> {
    const id = crypto.randomUUID();
    const newNote = {
      id,
      title: input.title,
      content: input.content,
      userId,
      notebookId: input.notebookId ?? null,
      color: input.color ?? '#ffffff',
      isArchived: false,
      isPinned: input.isPinned ?? false,
    };

    this.db.insert(notes).values(newNote).run();
    return this.findOne(id, userId);
  }

  async update(input: UpdateNoteInput, userId: string): Promise<Note> {
    const { id, ...updateData } = input;
    
    // Ensure the note exists and belongs to this user
    await this.findOne(id, userId);

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

    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<boolean> {
    // Ensure the note exists and belongs to this user
    await this.findOne(id, userId);

    this.db
      .delete(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .run();

    return true;
  }
}
