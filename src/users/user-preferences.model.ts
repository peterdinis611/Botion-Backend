import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsBoolean, IsOptional } from 'class-validator';

export const DEFAULT_SNAPS_PANEL_PREFERENCES = {
  showCaptions: true,
  compactCards: false,
  sortNewestFirst: true,
} as const;

export type SnapsPanelPreferencesData = {
  showCaptions: boolean;
  compactCards: boolean;
  sortNewestFirst: boolean;
};

export const DEFAULT_USER_PREFERENCES = {
  sidebarCollapsed: false,
  snapsPanel: { ...DEFAULT_SNAPS_PANEL_PREFERENCES },
} as const;

export type UserPreferencesData = {
  sidebarCollapsed: boolean;
  snapsPanel: SnapsPanelPreferencesData;
};

export function parseUserPreferencesJson(
  raw: string | null | undefined,
): UserPreferencesData {
  if (!raw) {
    return { ...DEFAULT_USER_PREFERENCES };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<UserPreferencesData>;
    const snapsRaw = parsed.snapsPanel as Partial<SnapsPanelPreferencesData> | undefined;
    return {
      sidebarCollapsed:
        typeof parsed.sidebarCollapsed === 'boolean'
          ? parsed.sidebarCollapsed
          : DEFAULT_USER_PREFERENCES.sidebarCollapsed,
      snapsPanel: {
        showCaptions:
          typeof snapsRaw?.showCaptions === 'boolean'
            ? snapsRaw.showCaptions
            : DEFAULT_SNAPS_PANEL_PREFERENCES.showCaptions,
        compactCards:
          typeof snapsRaw?.compactCards === 'boolean'
            ? snapsRaw.compactCards
            : DEFAULT_SNAPS_PANEL_PREFERENCES.compactCards,
        sortNewestFirst:
          typeof snapsRaw?.sortNewestFirst === 'boolean'
            ? snapsRaw.sortNewestFirst
            : DEFAULT_SNAPS_PANEL_PREFERENCES.sortNewestFirst,
      },
    };
  } catch {
    return { ...DEFAULT_USER_PREFERENCES };
  }
}

@ObjectType()
export class SnapsPanelPreferences {
  @Field()
  showCaptions: boolean;

  @Field()
  compactCards: boolean;

  @Field()
  sortNewestFirst: boolean;
}

@ObjectType()
export class UserPreferences {
  @Field()
  sidebarCollapsed: boolean;

  @Field(() => SnapsPanelPreferences)
  snapsPanel: SnapsPanelPreferences;
}

@InputType()
export class UpdateSnapsPanelPreferencesInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  showCaptions?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  compactCards?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  sortNewestFirst?: boolean;
}

@InputType()
export class UpdateUserPreferencesInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  sidebarCollapsed?: boolean;

  @Field(() => UpdateSnapsPanelPreferencesInput, { nullable: true })
  @IsOptional()
  snapsPanel?: UpdateSnapsPanelPreferencesInput;
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
