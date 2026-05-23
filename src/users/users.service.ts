import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.provider';
import type { DrizzleDB } from '../drizzle/drizzle.provider';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { CreateUserInput, UpdateUserInput } from './user.dto';
import { User, UserRole, UserStatus } from './user.model';
import {
  parseUserPreferencesJson,
  type UserPreferencesData,
} from './user-preferences.model';
import type { UpdateMyProfileInput, UpdateUserPreferencesInput } from './user-preferences.model';
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
    preferences: parseUserPreferencesJson(dbUser.preferences),
    createdAt: dbUser.createdAt,
  };
}

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  private getDbUser(id: string): DbUser {
    const results = this.db.select().from(users).where(eq(users.id, id)).all();
    const user = results[0];
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }
    return user;
  }

  async findAll(): Promise<User[]> {
    const rows = this.db.select().from(users).all();
    return rows.map(mapDbUserToModel);
  }

  async findOne(id: string, throwOnNotFound = true): Promise<User> {
    try {
      return mapDbUserToModel(this.getDbUser(id));
    } catch (e) {
      if (throwOnNotFound) throw e;
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }
  }

  async findByEmail(email: string): Promise<DbUser | null> {
    const results = this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .all();
    return results[0] || null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const existingUser = await this.findByEmail(input.email);
    if (existingUser) {
      throw new ConflictException(
        `Email "${input.email}" is already registered.`,
      );
    }

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
      preferences: JSON.stringify(parseUserPreferencesJson(null)),
    };
    this.db.insert(users).values(newUser).run();
    return this.findOne(id);
  }

  async update(input: UpdateUserInput): Promise<User> {
    const { id, ...updateData } = input;
    await this.findOne(id, true);

    if (updateData.email) {
      const existingUser = await this.findByEmail(updateData.email);
      if (existingUser && existingUser.id !== id) {
        throw new ConflictException(
          `Email "${updateData.email}" is already in use by another user.`,
        );
      }
    }

    const cleanedUpdateData = Object.fromEntries(
      Object.entries(updateData).filter(([_, v]) => v !== undefined),
    );
    this.db.update(users).set(cleanedUpdateData).where(eq(users.id, id)).run();
    return this.findOne(id);
  }

  async updateMyProfile(
    userId: string,
    input: UpdateMyProfileInput,
  ): Promise<User> {
    return this.update({
      id: userId,
      name: input.name,
      bio: input.bio,
      age: input.age,
    });
  }

  async updateMyPreferences(
    userId: string,
    input: UpdateUserPreferencesInput,
  ): Promise<User> {
    const dbUser = this.getDbUser(userId);
    const current = parseUserPreferencesJson(dbUser.preferences);
    const next: UserPreferencesData = {
      sidebarCollapsed:
        input.sidebarCollapsed ?? current.sidebarCollapsed,
    };

    this.db
      .update(users)
      .set({ preferences: JSON.stringify(next) })
      .where(eq(users.id, userId))
      .run();

    return this.findOne(userId);
  }

  async remove(id: string): Promise<boolean> {
    await this.findOne(id, true);
    this.db.delete(users).where(eq(users.id, id)).run();
    return true;
  }

  assertSelf(userId: string, targetId: string) {
    if (userId !== targetId) {
      throw new ForbiddenException('You can only update your own account.');
    }
  }
}
