import { InputType, Field, ID } from '@nestjs/graphql';
import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
  IsBoolean,
  IsISO8601,
} from 'class-validator';

@InputType()
export class CreateCalendarEventInput {
  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @Field()
  @IsISO8601()
  startAt: string;

  @Field()
  @IsISO8601()
  endAt: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid 6-character CSS Hex string (e.g. #3b82f6)',
  })
  color?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string;
}

@InputType()
export class UpdateCalendarEventInput {
  @Field(() => ID)
  @IsString()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsISO8601()
  endAt?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid 6-character CSS Hex string (e.g. #3b82f6)',
  })
  color?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string;
}
