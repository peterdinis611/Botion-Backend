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
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private parseJsonArray(raw: string | undefined, field: string): string {
    if (raw === undefined) return EMPTY_ARRAY_JSON;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error('not array');
      }
      return JSON.stringify(parsed);
    } catch {
      throw new BadRequestException(
        `${field} must be a valid JSON array.`,
      );
    }
  }

  private parseViewport(raw: string | undefined): string | null {
    if (raw === undefined || raw === null || raw === '') return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('not object');
      }
      return JSON.stringify(parsed);
    } catch {
      throw new BadRequestException('viewportJson must be a valid JSON object.');
    }
  }

  async findAll(userId: string): Promise<Graph[]> {
    const rows = this.db
      .select()
      .from(graphs)
      .where(eq(graphs.userId, userId))
      .orderBy(desc(graphs.updatedAt))
      .all();

    return rows.map(mapDbGraphToModel);
  }

  async findOne(id: string, userId: string): Promise<Graph> {
    const row = this.db
      .select()
      .from(graphs)
      .where(and(eq(graphs.id, id), eq(graphs.userId, userId)))
      .all()[0];

    if (!row) {
      throw new NotFoundException(`Graph with ID "${id}" not found.`);
    }

    return mapDbGraphToModel(row);
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

    return this.findOne(input.id, userId);
  }

  async remove(id: string, userId: string): Promise<boolean> {
    await this.findOne(id, userId);
    this.db
      .delete(graphs)
      .where(and(eq(graphs.id, id), eq(graphs.userId, userId)))
      .run();
    return true;
  }
}
