import { Injectable, Inject, ConflictException, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.provider';
import type { DrizzleDB } from '../drizzle/drizzle.provider';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { CreateUserInput, UpdateUserInput } from './user.dto';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    return this.db.select().from(users).all();
  }

  async findOne(id: string, throwOnNotFound = true) {
    const results = this.db.select().from(users).where(eq(users.id, id)).all();
    const user = results[0];
    if (!user && throwOnNotFound) {
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }
    return user || null;
  }

  async findByEmail(email: string) {
    const results = this.db.select().from(users).where(eq(users.email, email)).all();
    return results[0] || null;
  }

  async create(input: CreateUserInput) {
    // Check if email is already taken
    const existingUser = await this.findByEmail(input.email);
    if (existingUser) {
      throw new ConflictException(`Email "${input.email}" is already registered.`);
    }

    // Encrypt raw password
    const passwordHash = await bcrypt.hash(input.password, 10);

    const id = crypto.randomUUID();
    const newUser = {
      id,
      name: input.name,
      email: input.email,
      role: input.role ?? 'USER',
      status: input.status ?? 'ACTIVE',
      bio: input.bio ?? null,
      age: input.age ?? null,
      passwordHash,
    };
    this.db.insert(users).values(newUser).run();
    return this.findOne(id);
  }

  async update(input: UpdateUserInput) {
    const { id, ...updateData } = input;
    
    // Verify user exists first
    await this.findOne(id, true);

    // Verify email uniqueness if email is being updated
    if (updateData.email) {
      const existingUser = await this.findByEmail(updateData.email);
      if (existingUser && existingUser.id !== id) {
        throw new ConflictException(`Email "${updateData.email}" is already in use by another user.`);
      }
    }

    // Filter out undefined values to prevent overwriting with null
    const cleanedUpdateData = Object.fromEntries(
      Object.entries(updateData).filter(([_, v]) => v !== undefined),
    );
    this.db.update(users).set(cleanedUpdateData).where(eq(users.id, id)).run();
    return this.findOne(id);
  }

  async remove(id: string) {
    // Verify user exists
    await this.findOne(id, true);
    this.db.delete(users).where(eq(users.id, id)).run();
    return true;
  }
}
