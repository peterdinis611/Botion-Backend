import { InputType, Field, ID } from '@nestjs/graphql';
import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';

@InputType()
export class CreateGraphInput {
  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  nodesJson?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  edgesJson?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  viewportJson?: string;
}

@InputType()
export class UpdateGraphInput {
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
  @MaxLength(2000)
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  nodesJson?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  edgesJson?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  viewportJson?: string;
}
