import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString, MinLength, MaxLength, IsOptional, Matches } from 'class-validator';

@InputType()
export class CreateFolderInput {
  @Field()
  @IsString()
  @MinLength(1, { message: 'Name must not be empty' })
  @MaxLength(100, { message: 'Name must be at most 100 characters long' })
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid 6-character CSS Hex string (e.g. #ffffff)',
  })
  color?: string;
}

@InputType()
export class UpdateFolderInput {
  @Field(() => ID)
  @IsString()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Name must not be empty' })
  @MaxLength(100, { message: 'Name must be at most 100 characters long' })
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid 6-character CSS Hex string (e.g. #ffffff)',
  })
  color?: string;
}
