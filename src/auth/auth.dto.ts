import { InputType, Field, ObjectType, Int } from '@nestjs/graphql';
import { IsString, IsEmail, MinLength, MaxLength, IsEnum, IsInt, Min, Max, IsOptional } from 'class-validator';
import { User, UserRole, UserStatus } from '../users/user.model';

@InputType()
export class RegisterInput {
  @Field()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(50, { message: 'Name must be at most 50 characters long' })
  name: string;

  @Field()
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @Field()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(100, { message: 'Password must be at most 100 characters long' })
  password: string;

  @Field(() => UserRole, { nullable: true })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Invalid user role' })
  role?: UserRole;

  @Field(() => UserStatus, { nullable: true })
  @IsOptional()
  @IsEnum(UserStatus, { message: 'Invalid user status' })
  status?: UserStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Bio must be at most 500 characters long' })
  bio?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'Age must be at least 0' })
  @Max(150, { message: 'Age must be at most 150' })
  age?: number;
}

@InputType()
export class LoginInput {
  @Field()
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @Field()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}

@ObjectType()
export class AuthPayload {
  @Field()
  token: string;

  @Field(() => User)
  user: User;
}
