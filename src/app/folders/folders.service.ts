import {
  Injectable,
  Inject,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { DRIZZLE } from '../../drizzle/drizzle.provider';
import type { DrizzleDB } from '../../drizzle/drizzle.provider';
import { folders, notebooks } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { CreateFolderInput, UpdateFolderInput } from './folder.dto';
import { Folder } from './folder.model';
import * as crypto from 'crypto';
import { CacheService } from '../../cache/cache.service';
import { NotebooksService } from '../notebooks/notebooks.service';
import { Notebook } from '../notebooks/notebook.model';

const FOLDER_TTL_MS = 60_000; // 60 seconds

export type DbFolder = typeof folders.$inferSelect;

export function mapDbFolderToModel(dbFolder: DbFolder): Folder {
  return {
    id: dbFolder.id,
    name: dbFolder.name,
    color: dbFolder.color,
    userId: dbFolder.userId,
    createdAt: dbFolder.createdAt,
    updatedAt: dbFolder.updatedAt,
  };
}

@Injectable()
export class FoldersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly cacheService: CacheService,
    @Inject(forwardRef(() => NotebooksService))
    private readonly notebooksService: NotebooksService,
  ) {}

  async findAll(userId: string): Promise<Folder[]> {
    const cacheKey = `user:${userId}:folders`;
    const cached = this.cacheService.get<Folder[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const rows = this.db
      .select()
      .from(folders)
      .where(eq(folders.userId, userId))
      .all();

    const result = rows.map(mapDbFolderToModel);
    this.cacheService.set(cacheKey, result, FOLDER_TTL_MS);
    return result;
  }

  async findOne(id: string, userId: string): Promise<Folder> {
    const cacheKey = `folder:${id}:user:${userId}`;
    const cached = this.cacheService.get<Folder>(cacheKey);
    if (cached) {
      return cached;
    }

    const results = this.db
      .select()
      .from(folders)
      .where(and(eq(folders.id, id), eq(folders.userId, userId)))
      .all();

    const folder = results[0];
    if (!folder) {
      throw new NotFoundException(`Folder with ID "${id}" not found.`);
    }

    const model = mapDbFolderToModel(folder);
    this.cacheService.set(cacheKey, model, FOLDER_TTL_MS);
    return model;
  }

  async create(input: CreateFolderInput, userId: string): Promise<Folder> {
    const id = crypto.randomUUID();
    const newFolder = {
      id,
      name: input.name,
      userId,
      color: input.color ?? '#ffffff',
    };

    this.db.insert(folders).values(newFolder).run();

    // Invalidate folders list cache
    this.cacheService.delete(`user:${userId}:folders`);

    return this.findOne(id, userId);
  }

  async update(input: UpdateFolderInput, userId: string): Promise<Folder> {
    const { id, ...updateData } = input;

    // Ensure it exists and belongs to this user
    await this.findOne(id, userId);

    const cleanedData = Object.fromEntries(
      Object.entries(updateData).filter(([_, v]) => v !== undefined),
    );

    cleanedData.updatedAt = new Date().toISOString();

    this.db
      .update(folders)
      .set(cleanedData)
      .where(and(eq(folders.id, id), eq(folders.userId, userId)))
      .run();

    // Invalidate caches
    this.cacheService.delete(`folder:${id}:user:${userId}`);
    this.cacheService.delete(`user:${userId}:folders`);

    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<boolean> {
    // Ensure it exists and belongs to this user
    await this.findOne(id, userId);

    this.db
      .delete(folders)
      .where(and(eq(folders.id, id), eq(folders.userId, userId)))
      .run();

    // Invalidate caches
    this.cacheService.delete(`folder:${id}:user:${userId}`);
    this.cacheService.delete(`user:${userId}:folders`);

    // Notebooks inside this folder will have their folderId set to null (due to set null reference)
    // Invalidate notebooks caches and notes caches for safety
    this.cacheService.delete(`user:${userId}:notebooks`);
    this.cacheService.clearPattern(`notebook:*:user:${userId}`);
    this.cacheService.clearPattern(`user:${userId}:notes:*`);

    return true;
  }

  async moveNotebookToFolder(
    notebookId: string,
    folderId: string | null,
    userId: string,
  ): Promise<Notebook> {
    // Ensure notebook exists and belongs to user
    const notebook = await this.notebooksService.findOne(notebookId, userId);
    const oldFolderId = notebook.folderId;

    if (folderId !== null) {
      // Ensure target folder exists and belongs to user
      await this.findOne(folderId, userId);
    }

    // Update notebook
    this.db
      .update(notebooks)
      .set({ folderId, updatedAt: new Date().toISOString() })
      .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, userId)))
      .run();

    // Invalidate notebook caches
    this.cacheService.delete(`notebook:${notebookId}:user:${userId}`);
    this.cacheService.delete(`user:${userId}:notebooks`);

    // Invalidate folders caches
    this.cacheService.delete(`user:${userId}:folders`);
    if (folderId) {
      this.cacheService.delete(`folder:${folderId}:user:${userId}`);
    }
    if (oldFolderId) {
      this.cacheService.delete(`folder:${oldFolderId}:user:${userId}`);
    }

    // Invalidate notes list cache (since moving notebook can affect notes filtered by folderId)
    this.cacheService.clearPattern(`user:${userId}:notes:*`);

    return this.notebooksService.findOne(notebookId, userId);
  }
}
