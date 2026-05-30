import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../../drizzle/drizzle.provider';
import type { DrizzleDB } from '../../drizzle/drizzle.provider';
import { notebooks, notes } from '../../drizzle/schema';
import { eq, and, asc, isNull } from 'drizzle-orm';
import { CreateNotebookInput, UpdateNotebookInput } from './notebook.dto';
import { Notebook } from './notebook.model';
import * as crypto from 'crypto';
import { CacheService } from '../../cache/cache.service';

const NOTEBOOK_TTL_MS = 60_000; // 60 seconds

export type DbNotebook = typeof notebooks.$inferSelect;

export function mapDbNotebookToModel(dbNotebook: DbNotebook): Notebook {
  return {
    id: dbNotebook.id,
    name: dbNotebook.name,
    color: dbNotebook.color,
    sortOrder: dbNotebook.sortOrder,
    userId: dbNotebook.userId,
    folderId: dbNotebook.folderId ?? undefined,
    createdAt: dbNotebook.createdAt,
    updatedAt: dbNotebook.updatedAt,
  };
}

@Injectable()
export class NotebooksService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly cacheService: CacheService,
  ) {}

  async findAll(userId: string): Promise<Notebook[]> {
    const cacheKey = `user:${userId}:notebooks`;
    const cached = this.cacheService.get<Notebook[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const rows = this.db
      .select()
      .from(notebooks)
      .where(eq(notebooks.userId, userId))
      .orderBy(asc(notebooks.sortOrder))
      .all();

    const result = rows.map(mapDbNotebookToModel);
    this.cacheService.set(cacheKey, result, NOTEBOOK_TTL_MS);
    return result;
  }

  async findOne(id: string, userId: string): Promise<Notebook> {
    const cacheKey = `notebook:${id}:user:${userId}`;
    const cached = this.cacheService.get<Notebook>(cacheKey);
    if (cached) {
      return cached;
    }

    const results = this.db
      .select()
      .from(notebooks)
      .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)))
      .all();

    const notebook = results[0];
    if (!notebook) {
      throw new NotFoundException(`Notebook with ID "${id}" not found.`);
    }

    const model = mapDbNotebookToModel(notebook);
    this.cacheService.set(cacheKey, model, NOTEBOOK_TTL_MS);
    return model;
  }

  private nextNotebookSortOrder(
    userId: string,
    folderId: string | null,
  ): number {
    const condition = folderId
      ? and(eq(notebooks.userId, userId), eq(notebooks.folderId, folderId))
      : and(eq(notebooks.userId, userId), isNull(notebooks.folderId));

    const rows = this.db
      .select({ sortOrder: notebooks.sortOrder })
      .from(notebooks)
      .where(condition)
      .all();
    if (rows.length === 0) return 0;
    return Math.max(...rows.map((r) => r.sortOrder)) + 1;
  }

  async create(input: CreateNotebookInput, userId: string): Promise<Notebook> {
    const id = crypto.randomUUID();
    const folderId = input.folderId ?? null;
    const newNotebook = {
      id,
      name: input.name,
      userId,
      color: input.color ?? '#ffffff',
      folderId,
      sortOrder: this.nextNotebookSortOrder(userId, folderId),
    };

    this.db.insert(notebooks).values(newNotebook).run();

    // Invalidate notebook list for this user
    this.cacheService.delete(`user:${userId}:notebooks`);
    if (input.folderId) {
      this.cacheService.delete(`folder:${input.folderId}:user:${userId}`);
    }

    return this.findOne(id, userId);
  }

  async update(input: UpdateNotebookInput, userId: string): Promise<Notebook> {
    const { id, ...updateData } = input;

    // Ensure the notebook exists and belongs to this user
    const originalNotebook = await this.findOne(id, userId);
    const oldFolderId = originalNotebook.folderId;

    // Clean undefined fields to avoid overwriting with null
    const cleanedData = Object.fromEntries(
      Object.entries(updateData).filter(([_, v]) => v !== undefined),
    );

    // Force refresh the update timestamp
    cleanedData.updatedAt = new Date().toISOString();

    this.db
      .update(notebooks)
      .set(cleanedData)
      .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)))
      .run();

    // Invalidate stale caches
    this.cacheService.delete(`notebook:${id}:user:${userId}`);
    this.cacheService.delete(`user:${userId}:notebooks`);
    // Notes list may reflect notebook name/metadata changes
    this.cacheService.clearPattern(`user:${userId}:notes:*`);

    // Invalidate folders caches if folderId changed
    if (cleanedData.folderId !== undefined) {
      const newFolderId = cleanedData.folderId as string | null;
      if (newFolderId) {
        this.cacheService.delete(`folder:${newFolderId}:user:${userId}`);
      }
      if (oldFolderId) {
        this.cacheService.delete(`folder:${oldFolderId}:user:${userId}`);
      }
      this.cacheService.delete(`user:${userId}:folders`);
    }

    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<boolean> {
    // Ensure the notebook exists and belongs to this user
    const notebook = await this.findOne(id, userId);
    const folderId = notebook.folderId;

    const now = new Date().toISOString();
    this.db
      .update(notes)
      .set({ isArchived: true, updatedAt: now })
      .where(and(eq(notes.notebookId, id), eq(notes.userId, userId)))
      .run();

    this.db
      .delete(notebooks)
      .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)))
      .run();

    // Invalidate stale caches
    this.cacheService.delete(`notebook:${id}:user:${userId}`);
    this.cacheService.delete(`user:${userId}:notebooks`);
    // Notes that belonged to this notebook will have notebookId set to null — invalidate list
    this.cacheService.clearPattern(`user:${userId}:notes:*`);

    if (folderId) {
      this.cacheService.delete(`folder:${folderId}:user:${userId}`);
    }

    return true;
  }

  async reorder(
    userId: string,
    folderId: string | null,
    ids: string[],
  ): Promise<Notebook[]> {
    const all = await this.findAll(userId);
    const inScope = all.filter((nb) =>
      folderId === null ? !nb.folderId : nb.folderId === folderId,
    );
    const scopeIds = new Set(inScope.map((nb) => nb.id));
    for (const id of ids) {
      if (!scopeIds.has(id)) {
        throw new NotFoundException(`Notebook with ID "${id}" not found.`);
      }
    }

    const now = new Date().toISOString();
    ids.forEach((id, index) => {
      this.db
        .update(notebooks)
        .set({ sortOrder: index, updatedAt: now })
        .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)))
        .run();
    });

    this.cacheService.delete(`user:${userId}:notebooks`);
    if (folderId) {
      this.cacheService.delete(`folder:${folderId}:user:${userId}`);
    }
    this.cacheService.delete(`user:${userId}:folders`);

    return this.findAll(userId);
  }
}
