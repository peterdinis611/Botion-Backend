import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.provider';
import type { DrizzleDB } from '../drizzle/drizzle.provider';
import { noteRevisions, notes } from '../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
import { NoteRevision } from './note-revision.model';
import * as crypto from 'crypto';

@Injectable()
export class NoteRevisionsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async createRevision(
    noteId: string,
    title: string,
    content: string,
  ): Promise<void> {
    const id = crypto.randomUUID();
    const newRevision = {
      id,
      noteId,
      title,
      content,
    };
    this.db.insert(noteRevisions).values(newRevision).run();
  }

  async findAllForNote(
    noteId: string,
    userId: string,
  ): Promise<NoteRevision[]> {
    const rows = this.db
      .select({
        id: noteRevisions.id,
        noteId: noteRevisions.noteId,
        title: noteRevisions.title,
        content: noteRevisions.content,
        createdAt: noteRevisions.createdAt,
      })
      .from(noteRevisions)
      .innerJoin(notes, eq(noteRevisions.noteId, notes.id))
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
      .orderBy(desc(noteRevisions.createdAt))
      .all();

    return rows;
  }

  async findOne(revisionId: string, userId: string): Promise<NoteRevision> {
    const results = this.db
      .select({
        id: noteRevisions.id,
        noteId: noteRevisions.noteId,
        title: noteRevisions.title,
        content: noteRevisions.content,
        createdAt: noteRevisions.createdAt,
      })
      .from(noteRevisions)
      .innerJoin(notes, eq(noteRevisions.noteId, notes.id))
      .where(and(eq(noteRevisions.id, revisionId), eq(notes.userId, userId)))
      .all();

    const revision = results[0];
    if (!revision) {
      throw new NotFoundException(
        `Revision with ID "${revisionId}" not found.`,
      );
    }

    return revision;
  }
}
