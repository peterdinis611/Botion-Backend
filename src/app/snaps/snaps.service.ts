import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import * as crypto from 'crypto';
import { DRIZZLE } from '../../drizzle/drizzle.provider';
import type { DrizzleDB } from '../../drizzle/drizzle.provider';
import { snaps } from '../../drizzle/schema';
import { FilesService } from '../files/files.service';
import { CacheService } from '../../cache/cache.service';
import {
  CreateSnapInput,
  SnapListScope,
  UpdateSnapInput,
} from './snap.dto';
import { Snap } from './snap.model';

const SNAPS_TTL_MS = 60_000;

export type DbSnap = typeof snaps.$inferSelect;

export function mapDbSnapToModel(row: DbSnap): Snap {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    caption: row.caption ?? undefined,
    fileId: row.fileId,
    mimeType: row.mimeType,
    notebookId: row.notebookId ?? undefined,
    noteId: row.noteId ?? undefined,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class SnapsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly filesService: FilesService,
    private readonly cacheService: CacheService,
  ) {}

  private listCacheKey(
    userId: string,
    scope: SnapListScope,
    notebookId?: string,
    noteId?: string,
  ): string {
    return `user:${userId}:snaps:${scope}:${notebookId ?? ''}:${noteId ?? ''}`;
  }

  private invalidateListCaches(userId: string): void {
    this.cacheService.clearPattern(`user:${userId}:snaps:*`);
  }

  private async assertImageFile(userId: string, fileId: string) {
    const record = await this.filesService.findRecord(userId, fileId);
    if (!record.mimeType.startsWith('image/')) {
      throw new BadRequestException('Snaps only support image files.');
    }
    return record;
  }

  async findAll(
    userId: string,
    options: {
      scope?: SnapListScope;
      notebookId?: string;
      noteId?: string;
    } = {},
  ): Promise<Snap[]> {
    const scope = options.scope ?? SnapListScope.ALL;
    const cacheKey = this.listCacheKey(
      userId,
      scope,
      options.notebookId,
      options.noteId,
    );
    const cached = this.cacheService.get<Snap[]>(cacheKey);
    if (cached) return cached;

    const conditions = [eq(snaps.userId, userId)];

    if (scope === SnapListScope.NOTEBOOK && options.notebookId) {
      conditions.push(eq(snaps.notebookId, options.notebookId));
    } else if (scope === SnapListScope.NOTE && options.noteId) {
      conditions.push(eq(snaps.noteId, options.noteId));
    }

    const rows = this.db
      .select()
      .from(snaps)
      .where(and(...conditions))
      .orderBy(desc(snaps.sortOrder), desc(snaps.createdAt))
      .all();

    const result = rows.map(mapDbSnapToModel);
    this.cacheService.set(cacheKey, result, SNAPS_TTL_MS);
    return result;
  }

  async findOne(id: string, userId: string): Promise<Snap> {
    const row = this.db
      .select()
      .from(snaps)
      .where(and(eq(snaps.id, id), eq(snaps.userId, userId)))
      .all()[0];

    if (!row) {
      throw new NotFoundException(`Snap with ID "${id}" not found.`);
    }

    return mapDbSnapToModel(row);
  }

  async create(input: CreateSnapInput, userId: string): Promise<Snap> {
    const file = await this.assertImageFile(userId, input.fileId);

    const userSnaps = this.db
      .select({ sortOrder: snaps.sortOrder })
      .from(snaps)
      .where(eq(snaps.userId, userId))
      .all();
    const nextOrder =
      userSnaps.length > 0
        ? Math.max(...userSnaps.map((s) => s.sortOrder)) + 1
        : 0;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db
      .insert(snaps)
      .values({
        id,
        userId,
        title: input.title?.trim() || 'Untitled snap',
        caption: input.caption?.trim() || null,
        fileId: input.fileId,
        mimeType: file.mimeType,
        notebookId: input.notebookId ?? null,
        noteId: input.noteId ?? null,
        sortOrder: nextOrder,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    this.invalidateListCaches(userId);
    return this.findOne(id, userId);
  }

  async update(input: UpdateSnapInput, userId: string): Promise<Snap> {
    const existing = await this.findOne(input.id, userId);
    const now = new Date().toISOString();

    this.db
      .update(snaps)
      .set({
        title: input.title?.trim() ?? existing.title,
        caption:
          input.caption !== undefined
            ? input.caption.trim() || null
            : existing.caption ?? null,
        notebookId:
          input.notebookId !== undefined
            ? input.notebookId
            : existing.notebookId ?? null,
        noteId:
          input.noteId !== undefined ? input.noteId : existing.noteId ?? null,
        updatedAt: now,
      })
      .where(and(eq(snaps.id, input.id), eq(snaps.userId, userId)))
      .run();

    this.invalidateListCaches(userId);
    return this.findOne(input.id, userId);
  }

  async reorder(ids: string[], userId: string): Promise<Snap[]> {
    const owned = this.db
      .select({ id: snaps.id })
      .from(snaps)
      .where(eq(snaps.userId, userId))
      .all();
    const ownedSet = new Set(owned.map((r) => r.id));

    for (const id of ids) {
      if (!ownedSet.has(id)) {
        throw new NotFoundException(`Snap with ID "${id}" not found.`);
      }
    }

    const now = new Date().toISOString();
    ids.forEach((id, index) => {
      this.db
        .update(snaps)
        .set({ sortOrder: ids.length - index, updatedAt: now })
        .where(and(eq(snaps.id, id), eq(snaps.userId, userId)))
        .run();
    });

    this.invalidateListCaches(userId);
    return this.findAll(userId);
  }

  async remove(id: string, userId: string): Promise<boolean> {
    await this.findOne(id, userId);
    this.db
      .delete(snaps)
      .where(and(eq(snaps.id, id), eq(snaps.userId, userId)))
      .run();
    this.invalidateListCaches(userId);
    return true;
  }
}
