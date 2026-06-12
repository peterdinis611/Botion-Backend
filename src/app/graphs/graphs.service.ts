import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE } from '../../drizzle/drizzle.provider';
import type { DrizzleDB } from '../../drizzle/drizzle.provider';
import { graphs } from '../../drizzle/schema';
import { and, eq, desc } from 'drizzle-orm';
import * as crypto from 'crypto';
import { CreateGraphInput, UpdateGraphInput } from './graph.dto';
import { Graph } from './graph.model';
import { CacheService } from '../../cache/cache.service';
import {
  CACHE_TTL_DETAIL_MS,
  CACHE_TTL_META_MS,
} from '../../cache/cache.constants';

export type DbGraph = typeof graphs.$inferSelect;

const EMPTY_ARRAY_JSON = '[]';

export function mapDbGraphToModel(row: DbGraph): Graph {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    userId: row.userId,
    nodesJson: row.nodesJson,
    edgesJson: row.edgesJson,
    viewportJson: row.viewportJson ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class GraphsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly cacheService: CacheService,
  ) {}

  private invalidateUserGraphs(userId: string, graphId?: string): void {
    this.cacheService.delete(`user:${userId}:graphs`);
    if (graphId) {
      this.cacheService.delete(`graph:${graphId}:user:${userId}`);
    }
  }

  private parseJsonArray(raw: string | undefined, field: string): string {
    if (raw === undefined) return EMPTY_ARRAY_JSON;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error('not array');
      }
      return JSON.stringify(parsed);
    } catch {
      throw new BadRequestException(`${field} must be a valid JSON array.`);
    }
  }

  private parseViewport(raw: string | undefined): string | null {
    if (raw === undefined || raw === null || raw === '') return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        throw new Error('not object');
      }
      return JSON.stringify(parsed);
    } catch {
      throw new BadRequestException(
        'viewportJson must be a valid JSON object.',
      );
    }
  }

  async findAll(userId: string): Promise<Graph[]> {
    const cacheKey = `user:${userId}:graphs`;
    const cached = this.cacheService.get<Graph[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const rows = this.db
      .select()
      .from(graphs)
      .where(eq(graphs.userId, userId))
      .orderBy(desc(graphs.updatedAt))
      .all();

    const result = rows.map(mapDbGraphToModel);
    this.cacheService.set(cacheKey, result, CACHE_TTL_META_MS);
    return result;
  }

  async findOne(id: string, userId: string): Promise<Graph> {
    const cacheKey = `graph:${id}:user:${userId}`;
    const cached = this.cacheService.get<Graph>(cacheKey);
    if (cached) {
      return cached;
    }

    const row = this.db
      .select()
      .from(graphs)
      .where(and(eq(graphs.id, id), eq(graphs.userId, userId)))
      .all()[0];

    if (!row) {
      throw new NotFoundException(`Graph with ID "${id}" not found.`);
    }

    const model = mapDbGraphToModel(row);
    this.cacheService.set(cacheKey, model, CACHE_TTL_DETAIL_MS);
    return model;
  }

  async create(input: CreateGraphInput, userId: string): Promise<Graph> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const nodesJson = this.parseJsonArray(input.nodesJson, 'nodesJson');
    const edgesJson = this.parseJsonArray(input.edgesJson, 'edgesJson');
    const viewportJson = this.parseViewport(input.viewportJson);

    this.db
      .insert(graphs)
      .values({
        id,
        title: input.title,
        description: input.description ?? null,
        userId,
        nodesJson,
        edgesJson,
        viewportJson,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    this.invalidateUserGraphs(userId);
    return this.findOne(id, userId);
  }

  async update(input: UpdateGraphInput, userId: string): Promise<Graph> {
    await this.findOne(input.id, userId);

    const cleaned: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (input.title !== undefined) cleaned.title = input.title;
    if (input.description !== undefined) {
      cleaned.description = input.description;
    }
    if (input.nodesJson !== undefined) {
      cleaned.nodesJson = this.parseJsonArray(input.nodesJson, 'nodesJson');
    }
    if (input.edgesJson !== undefined) {
      cleaned.edgesJson = this.parseJsonArray(input.edgesJson, 'edgesJson');
    }
    if (input.viewportJson !== undefined) {
      cleaned.viewportJson = this.parseViewport(input.viewportJson);
    }

    this.db
      .update(graphs)
      .set(cleaned)
      .where(and(eq(graphs.id, input.id), eq(graphs.userId, userId)))
      .run();

    this.invalidateUserGraphs(userId, input.id);
    return this.findOne(input.id, userId);
  }

  async remove(id: string, userId: string): Promise<boolean> {
    await this.findOne(id, userId);
    this.db
      .delete(graphs)
      .where(and(eq(graphs.id, id), eq(graphs.userId, userId)))
      .run();
    this.invalidateUserGraphs(userId, id);
    return true;
  }
}
