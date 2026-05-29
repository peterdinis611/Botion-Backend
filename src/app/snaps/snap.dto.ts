import { Field, ID, InputType, registerEnumType } from '@nestjs/graphql';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum SnapListScope {
  ALL = 'ALL',
  NOTEBOOK = 'NOTEBOOK',
  NOTE = 'NOTE',
}

registerEnumType(SnapListScope, { name: 'SnapListScope' });

@InputType()
export class CreateSnapInput {
  @Field()
  @IsString()
  fileId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notebookId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  noteId?: string;
}

@InputType()
export class UpdateSnapInput {
  @Field(() => ID)
  @IsString()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notebookId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  noteId?: string;
}

@InputType()
export class SnapsPanelPreferencesInput {
  @Field({ nullable: true })
  @IsOptional()
  showCaptions?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  compactCards?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  sortNewestFirst?: boolean;
}
