import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.provider';
import type { DrizzleDB } from '../drizzle/drizzle.provider';
import { notebooks } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { CreateNotebookInput, UpdateNotebookInput } from './notebook.dto';
import { Notebook } from './notebook.model';
import * as crypto from 'crypto';
import { CacheService } from '../cache/cache.service';

const NOTEBOOK_TTL_MS = 60_000; // 60 seconds

export type DbNotebook = typeof notebooks.$inferSelect;

export function mapDbNotebookToModel(dbNotebook: DbNotebook): Notebook {
  return {
    id: dbNotebook.id,
    name: dbNotebook.name,
    color: dbNotebook.color,
    userId: dbNotebook.userId,
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

  async create(input: CreateNotebookInput, userId: string): Promise<Notebook> {
    const id = crypto.randomUUID();
    const newNotebook = {
      id,
      name: input.name,
      userId,
      color: input.color ?? '#ffffff',
    };

    this.db.insert(notebooks).values(newNotebook).run();

    // Invalidate notebook list for this user
    this.cacheService.delete(`user:${userId}:notebooks`);

    return this.findOne(id, userId);
  }

  async update(input: UpdateNotebookInput, userId: string): Promise<Notebook> {
    const { id, ...updateData } = input;

    // Ensure the notebook exists and belongs to this user
    await this.findOne(id, userId);

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

    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<boolean> {
    // Ensure the notebook exists and belongs to this user
    await this.findOne(id, userId);

    this.db
      .delete(notebooks)
      .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)))
      .run();

    // Invalidate stale caches
    this.cacheService.delete(`notebook:${id}:user:${userId}`);
    this.cacheService.delete(`user:${userId}:notebooks`);
    // Notes that belonged to this notebook will have notebookId set to null — invalidate list
    this.cacheService.clearPattern(`user:${userId}:notes:*`);

    return true;
  }
}
