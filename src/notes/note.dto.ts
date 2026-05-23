import { InputType, Field, ID, registerEnumType } from '@nestjs/graphql';

export enum SharePermission {
  READ = 'READ',
  WRITE = 'WRITE',
}

registerEnumType(SharePermission, { name: 'SharePermission' });
import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
  IsBoolean,
  IsArray,
} from 'class-validator';

@InputType()
export class CreateNoteInput {
  @Field()
  @IsString()
  @MinLength(1, { message: 'Title must not be empty' })
  @MaxLength(200, { message: 'Title must be at most 200 characters long' })
  title: string;

  @Field()
  @IsString()
  @MaxLength(10000, {
    message: 'Content must be at most 10000 characters long',
  })
  content: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid 6-character CSS Hex string (e.g. #ffffff)',
  })
  color?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notebookId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean({ message: 'isPinned must be a boolean' })
  isPinned?: boolean;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];
}

@InputType()
export class UpdateNoteInput {
  @Field(() => ID)
  @IsString()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Title must not be empty' })
  @MaxLength(200, { message: 'Title must be at most 200 characters long' })
  title?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10000, {
    message: 'Content must be at most 10000 characters long',
  })
  content?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid 6-character CSS Hex string (e.g. #ffffff)',
  })
  color?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean({ message: 'isArchived must be a boolean' })
  isArchived?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notebookId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean({ message: 'isPinned must be a boolean' })
  isPinned?: boolean;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];
}

@InputType()
export class ShareNoteInput {
  @Field(() => ID)
  @IsString()
  noteId: string;

  @Field()
  @IsString()
  sharedWithEmail: string;

  @Field(() => SharePermission)
  permission: SharePermission;
}

@InputType()
export class UnshareNoteInput {
  @Field(() => ID)
  @IsString()
  noteId: string;

  @Field(() => ID)
  @IsString()
  sharedWithUserId: string;
}
