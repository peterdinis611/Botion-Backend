import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE } from '../../drizzle/drizzle.provider';
import type { DrizzleDB } from '../../drizzle/drizzle.provider';
import { tags, notesToTags, notes } from '../../drizzle/schema';
import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { CreateTagInput, UpdateTagInput } from './tag.dto';
import { Tag } from './tag.model';
import { NotebooksService } from '../notebooks/notebooks.service';
import { CacheService } from '../../cache/cache.service';
import { CACHE_TTL_META_MS } from '../../cache/cache.constants';
import * as crypto from 'crypto';

export type DbTag = typeof tags.$inferSelect;

export function normalizeTagName(name: string): string {
  return name.trim().replace(/^#+/, '').toLowerCase();
}

export function mapDbTagToModel(dbTag: DbTag, noteCount = 0): Tag {
  return {
    id: dbTag.id,
    name: dbTag.name,
    color: dbTag.color,
    userId: dbTag.userId,
    notebookId: dbTag.notebookId ?? undefined,
    sortOrder: dbTag.sortOrder,
    noteCount,
    createdAt: dbTag.createdAt,
  };
}

@Injectable()
export class TagsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly notebooksService: NotebooksService,
    private readonly cacheService: CacheService,
  ) {}

  private invalidateUserTags(userId: string): void {
    this.cacheService.clearPattern(`user:${userId}:tags:*`);
  }

  private async assertNotebookAccess(
    notebookId: string | null | undefined,
    userId: string,
  ): Promise<string | null> {
    if (!notebookId) return null;
    await this.notebooksService.findOne(notebookId, userId);
    return notebookId;
  }

  private async countNotesForTag(tagId: string, userId: string): Promise<number> {
    const row = this.db
      .select({ count: sql<number>`count(*)` })
      .from(notesToTags)
      .innerJoin(notes, eq(notesToTags.noteId, notes.id))
      .where(and(eq(notesToTags.tagId, tagId), eq(notes.userId, userId)))
      .all()[0];
    return Number(row?.count ?? 0);
  }

  private async attachNoteCounts(userId: string, rows: DbTag[]): Promise<Tag[]> {
    return Promise.all(
      rows.map(async (row) =>
        mapDbTagToModel(row, await this.countNotesForTag(row.id, userId)),
      ),
    );
  }

  private findDuplicate(
    userId: string,
    name: string,
    notebookId: string | null,
    excludeId?: string,
  ): DbTag | undefined {
    const conditions = [
      eq(tags.userId, userId),
      eq(tags.name, name),
      notebookId
        ? eq(tags.notebookId, notebookId)
        : isNull(tags.notebookId),
    ];
    if (excludeId) {
      // drizzle ne supports ne easily in and - filter in memory for exclude
    }
    const rows = this.db
      .select()
      .from(tags)
      .where(and(...conditions))
      .all();
    return rows.find((r) => r.id !== excludeId);
  }

  async findAll(
    userId: string,
    options: {
      notebookId?: string;
      includeGlobal?: boolean;
    } = {},
  ): Promise<Tag[]> {
    const cacheKey = `user:${userId}:tags:all:nb:${options.notebookId ?? ''}:global:${options.includeGlobal ?? true}`;
    const cached = this.cacheService.get<Tag[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const conditions = [eq(tags.userId, userId)];

    if (options.notebookId) {
      if (options.includeGlobal ?? true) {
        conditions.push(
          or(
            eq(tags.notebookId, options.notebookId),
            isNull(tags.notebookId),
          )!,
        );
      } else {
        conditions.push(eq(tags.notebookId, options.notebookId));
      }
    }

    const rows = this.db
      .select()
      .from(tags)
      .where(and(...conditions))
      .orderBy(asc(tags.sortOrder), asc(tags.name))
      .all();

    const result = await this.attachNoteCounts(userId, rows);
    this.cacheService.set(cacheKey, result, CACHE_TTL_META_MS);
    return result;
  }

  /** Tags defined for a notebook plus tags used on notes in that notebook. */
  async findWorkspaceTags(
    userId: string,
    notebookId: string,
  ): Promise<Tag[]> {
    const cacheKey = `user:${userId}:tags:workspace:${notebookId}`;
    const cached = this.cacheService.get<Tag[]>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.notebooksService.findOne(notebookId, userId);

    const scoped = await this.findAll(userId, {
      notebookId,
      includeGlobal: true,
    });

    const usedInNotebook = this.db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
        userId: tags.userId,
        notebookId: tags.notebookId,
        sortOrder: tags.sortOrder,
        createdAt: tags.createdAt,
      })
      .from(tags)
      .innerJoin(notesToTags, eq(tags.id, notesToTags.tagId))
      .innerJoin(notes, eq(notesToTags.noteId, notes.id))
      .where(and(eq(notes.userId, userId), eq(notes.notebookId, notebookId)))
      .groupBy(tags.id)
      .all();

    const map = new Map<string, DbTag>();
    for (const row of scoped) {
      map.set(row.id, {
        id: row.id,
        name: row.name,
        color: row.color,
        userId: row.userId,
        notebookId: row.notebookId ?? null,
        sortOrder: row.sortOrder,
        createdAt: row.createdAt,
      });
    }
    for (const row of usedInNotebook) {
      if (!map.has(row.id)) {
        map.set(row.id, row);
      }
    }

    const merged = [...map.values()].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );

    const result = await this.attachNoteCounts(userId, merged);
    this.cacheService.set(cacheKey, result, CACHE_TTL_META_MS);
    return result;
  }

  async findOne(id: string, userId: string): Promise<Tag> {
    const results = this.db
      .select()
      .from(tags)
      .where(and(eq(tags.id, id), eq(tags.userId, userId)))
      .all();

    const tag = results[0];
    if (!tag) {
      throw new NotFoundException(`Tag with ID "${id}" not found.`);
    }

    return mapDbTagToModel(tag, await this.countNotesForTag(id, userId));
  }

  async create(input: CreateTagInput, userId: string): Promise<Tag> {
    const name = normalizeTagName(input.name);
    if (!name) {
      throw new BadRequestException('Tag name cannot be empty.');
    }

    const notebookId = await this.assertNotebookAccess(
      input.notebookId ?? null,
      userId,
    );

    const duplicate = this.findDuplicate(userId, name, notebookId);
    if (duplicate) {
      throw new BadRequestException(
        `Tag "${name}" already exists in this workspace.`,
      );
    }

    const maxOrder = this.db
      .select({ max: sql<number>`max(${tags.sortOrder})` })
      .from(tags)
      .where(
        and(
          eq(tags.userId, userId),
          notebookId
            ? eq(tags.notebookId, notebookId)
            : isNull(tags.notebookId),
        ),
      )
      .all()[0];

    const id = crypto.randomUUID();
    const newTag = {
      id,
      name,
      userId,
      color: input.color ?? '#b8a04a',
      notebookId,
      sortOrder: Number(maxOrder?.max ?? -1) + 1,
    };

    this.db.insert(tags).values(newTag).run();
    this.invalidateUserTags(userId);
    return this.findOne(id, userId);
  }

  async update(input: UpdateTagInput, userId: string): Promise<Tag> {
    const existing = await this.findOne(input.id, userId);

    const name =
      input.name !== undefined
        ? normalizeTagName(input.name)
        : existing.name;
    if (!name) {
      throw new BadRequestException('Tag name cannot be empty.');
    }

    const notebookId =
      input.notebookId !== undefined
        ? await this.assertNotebookAccess(input.notebookId, userId)
        : (existing.notebookId ?? null);

    const duplicate = this.findDuplicate(userId, name, notebookId, input.id);
    if (duplicate) {
      throw new BadRequestException(
        `Tag "${name}" already exists in this workspace.`,
      );
    }

    this.db
      .update(tags)
      .set({
        name,
        color: input.color ?? existing.color,
        notebookId,
        sortOrder: input.sortOrder ?? existing.sortOrder,
      })
      .where(and(eq(tags.id, input.id), eq(tags.userId, userId)))
      .run();

    this.invalidateUserTags(userId);
    return this.findOne(input.id, userId);
  }

  async remove(id: string, userId: string): Promise<boolean> {
    await this.findOne(id, userId);

    this.db.delete(notesToTags).where(eq(notesToTags.tagId, id)).run();
    this.db
      .delete(tags)
      .where(and(eq(tags.id, id), eq(tags.userId, userId)))
      .run();

    this.invalidateUserTags(userId);
    return true;
  }

  async findTagsForNote(noteId: string): Promise<Tag[]> {
    const rows = this.db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
        userId: tags.userId,
        notebookId: tags.notebookId,
        sortOrder: tags.sortOrder,
        createdAt: tags.createdAt,
      })
      .from(tags)
      .innerJoin(notesToTags, eq(tags.id, notesToTags.tagId))
      .where(eq(notesToTags.noteId, noteId))
      .all();

    return rows.map((row) => mapDbTagToModel(row));
  }

  async setNoteTags(
    noteId: string,
    tagIds: string[],
    userId: string,
  ): Promise<void> {
    if (tagIds.length > 0) {
      const userTags = this.db
        .select()
        .from(tags)
        .where(and(eq(tags.userId, userId), inArray(tags.id, tagIds)))
        .all();

      if (userTags.length !== tagIds.length) {
        throw new BadRequestException(
          'One or more tag IDs are invalid or do not belong to the user.',
        );
      }
    }

    this.db.delete(notesToTags).where(eq(notesToTags.noteId, noteId)).run();

    for (const tagId of tagIds) {
      this.db.insert(notesToTags).values({ noteId, tagId }).run();
    }

    this.invalidateUserTags(userId);
  }
}
