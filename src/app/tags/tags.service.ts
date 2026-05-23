import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE } from '../../drizzle/drizzle.provider';
import type { DrizzleDB } from '../../drizzle/drizzle.provider';
import { tags, notesToTags } from '../../drizzle/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { CreateTagInput, UpdateTagInput } from './tag.dto';
import { Tag } from './tag.model';
import * as crypto from 'crypto';

export type DbTag = typeof tags.$inferSelect;

export function mapDbTagToModel(dbTag: DbTag): Tag {
  return {
    id: dbTag.id,
    name: dbTag.name,
    color: dbTag.color,
    userId: dbTag.userId,
    createdAt: dbTag.createdAt,
  };
}

@Injectable()
export class TagsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(userId: string): Promise<Tag[]> {
    const rows = this.db
      .select()
      .from(tags)
      .where(eq(tags.userId, userId))
      .all();
    return rows.map(mapDbTagToModel);
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

    return mapDbTagToModel(tag);
  }

  async create(input: CreateTagInput, userId: string): Promise<Tag> {
    // Check if tag with the same name already exists for this user to avoid duplicates
    const existing = this.db
      .select()
      .from(tags)
      .where(and(eq(tags.userId, userId), eq(tags.name, input.name)))
      .all();

    if (existing.length > 0) {
      throw new BadRequestException(
        `Tag with name "${input.name}" already exists.`,
      );
    }

    const id = crypto.randomUUID();
    const newTag = {
      id,
      name: input.name,
      userId,
      color: input.color ?? '#808080',
    };

    this.db.insert(tags).values(newTag).run();
    return this.findOne(id, userId);
  }

  async update(input: UpdateTagInput, userId: string): Promise<Tag> {
    const { id, ...updateData } = input;

    // Ensure the tag exists and belongs to this user
    await this.findOne(id, userId);

    const cleanedData = Object.fromEntries(
      Object.entries(updateData).filter(([_, v]) => v !== undefined),
    );

    this.db
      .update(tags)
      .set(cleanedData)
      .where(and(eq(tags.id, id), eq(tags.userId, userId)))
      .run();

    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<boolean> {
    // Ensure the tag exists and belongs to this user
    await this.findOne(id, userId);

    this.db
      .delete(tags)
      .where(and(eq(tags.id, id), eq(tags.userId, userId)))
      .run();

    return true;
  }

  async findTagsForNote(noteId: string): Promise<Tag[]> {
    const rows = this.db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
        userId: tags.userId,
        createdAt: tags.createdAt,
      })
      .from(tags)
      .innerJoin(notesToTags, eq(tags.id, notesToTags.tagId))
      .where(eq(notesToTags.noteId, noteId))
      .all();

    return rows.map(mapDbTagToModel);
  }

  async setNoteTags(
    noteId: string,
    tagIds: string[],
    userId: string,
  ): Promise<void> {
    if (tagIds.length > 0) {
      // Validate that all tagIds belong to the user
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

    // Clear old tags
    this.db.delete(notesToTags).where(eq(notesToTags.noteId, noteId)).run();

    // Insert new tags
    for (const tagId of tagIds) {
      this.db.insert(notesToTags).values({ noteId, tagId }).run();
    }
  }
}
