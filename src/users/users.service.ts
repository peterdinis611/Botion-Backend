import { Injectable, Inject, ConflictException, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.provider';
import type { DrizzleDB } from '../drizzle/drizzle.provider';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { CreateUserInput, UpdateUserInput } from './user.dto';
import { User, UserRole, UserStatus } from './user.model';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

export type DbUser = typeof users.$inferSelect;

export function mapDbUserToModel(dbUser: DbUser): User {
  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role as UserRole,
    status: dbUser.status as UserStatus,
    bio: dbUser.bio ?? undefined,
    age: dbUser.age ?? undefined,
    createdAt: dbUser.createdAt,
  };
}

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll(): Promise<User[]> {
    const rows = this.db.select().from(users).all();
    return rows.map(mapDbUserToModel);
  }

  async findOne(id: string, throwOnNotFound = true): Promise<User> {
    const results = this.db.select().from(users).where(eq(users.id, id)).all();
    const user = results[0];
    if (!user) {
      if (throwOnNotFound) {
        throw new NotFoundException(`User with ID "${id}" not found.`);
      }
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }
    return mapDbUserToModel(user);
  }

  async findByEmail(email: string): Promise<DbUser | null> {
    const results = this.db.select().from(users).where(eq(users.email, email)).all();
    return results[0] || null;
  }

  async create(input: CreateUserInput): Promise<User> {
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

  async update(input: UpdateUserInput): Promise<User> {
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

  async remove(id: string): Promise<boolean> {
    // Verify user exists
    await this.findOne(id, true);
    this.db.delete(users).where(eq(users.id, id)).run();
    return true;
  }
}
