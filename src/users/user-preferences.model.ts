import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsBoolean, IsOptional } from 'class-validator';

export const DEFAULT_USER_PREFERENCES = {
  sidebarCollapsed: false,
} as const;

export type UserPreferencesData = {
  sidebarCollapsed: boolean;
};

export function parseUserPreferencesJson(
  raw: string | null | undefined,
): UserPreferencesData {
  if (!raw) {
    return { ...DEFAULT_USER_PREFERENCES };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<UserPreferencesData>;
    return {
      sidebarCollapsed:
        typeof parsed.sidebarCollapsed === 'boolean'
          ? parsed.sidebarCollapsed
          : DEFAULT_USER_PREFERENCES.sidebarCollapsed,
    };
  } catch {
    return { ...DEFAULT_USER_PREFERENCES };
  }
}

@ObjectType()
export class UserPreferences {
  @Field()
  sidebarCollapsed: boolean;
}

@InputType()
export class UpdateUserPreferencesInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  sidebarCollapsed?: boolean;
}

@InputType()
export class UpdateMyProfileInput {
  @Field({ nullable: true })
  @IsOptional()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  bio?: string;

  @Field({ nullable: true })
  @IsOptional()
  age?: number;
}
