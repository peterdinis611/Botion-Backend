import { Field, ID, InputType, Int } from '@nestjs/graphql';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

@InputType()
export class CreateTagInput {
  @Field()
  @IsString()
  @MinLength(1, { message: 'Name must not be empty' })
  @MaxLength(50, { message: 'Name must be at most 50 characters long' })
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid 6-character CSS Hex string (e.g. #808080)',
  })
  color?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notebookId?: string;
}

@InputType()
export class UpdateTagInput {
  @Field(() => ID)
  @IsString()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Name must not be empty' })
  @MaxLength(50, { message: 'Name must be at most 50 characters long' })
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid 6-character CSS Hex string (e.g. #808080)',
  })
  color?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notebookId?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
