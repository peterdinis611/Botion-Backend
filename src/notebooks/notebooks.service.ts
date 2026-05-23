import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.provider';
import type { DrizzleDB } from '../drizzle/drizzle.provider';
import { notebooks } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { CreateNotebookInput, UpdateNotebookInput } from './notebook.dto';
import { Notebook } from './notebook.model';
import * as crypto from 'crypto';

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
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(userId: string): Promise<Notebook[]> {
    const rows = this.db
      .select()
      .from(notebooks)
      .where(eq(notebooks.userId, userId))
      .all();
    return rows.map(mapDbNotebookToModel);
  }

  async findOne(id: string, userId: string): Promise<Notebook> {
    const results = this.db
      .select()
      .from(notebooks)
      .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)))
      .all();

    const notebook = results[0];
    if (!notebook) {
      throw new NotFoundException(`Notebook with ID "${id}" not found.`);
    }

    return mapDbNotebookToModel(notebook);
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

    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<boolean> {
    // Ensure the notebook exists and belongs to this user
    await this.findOne(id, userId);

    this.db
      .delete(notebooks)
      .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)))
      .run();

    return true;
  }
}
