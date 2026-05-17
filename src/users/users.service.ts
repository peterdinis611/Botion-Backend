import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.provider';
import type { DrizzleDB } from '../drizzle/drizzle.provider';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { CreateUserInput, UpdateUserInput } from './user.dto';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    return this.db.select().from(users).all();
  }

  async findOne(id: string) {
    const results = this.db.select().from(users).where(eq(users.id, id)).all();
    return results[0] || null;
  }

  async findByEmail(email: string) {
    const results = this.db.select().from(users).where(eq(users.email, email)).all();
    return results[0] || null;
  }

  async create(input: CreateUserInput) {
    const id = crypto.randomUUID();
    const newUser = {
      id,
      name: input.name,
      email: input.email,
    };
    this.db.insert(users).values(newUser).run();
    return this.findOne(id);
  }

  async update(input: UpdateUserInput) {
    const { id, ...updateData } = input;
    // Filter out undefined values to prevent overwriting with null
    const cleanedUpdateData = Object.fromEntries(
      Object.entries(updateData).filter(([_, v]) => v !== undefined),
    );
    this.db.update(users).set(cleanedUpdateData).where(eq(users.id, id)).run();
    return this.findOne(id);
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    if (!user) return false;
    this.db.delete(users).where(eq(users.id, id)).run();
    return true;
  }
}
