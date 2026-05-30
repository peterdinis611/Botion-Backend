import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

@InputType()
export class InviteWorkspaceMemberInput {
  @Field()
  @IsEmail()
  email: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}

@ObjectType()
export class InviteWorkspaceMemberResult {
  @Field()
  success: boolean;

  @Field()
  message: string;
}

@InputType()
export class AcceptWorkspaceInviteInput {
  @Field()
  @IsString()
  inviteId: string;
}

@ObjectType()
export class AcceptWorkspaceInviteResult {
  @Field()
  success: boolean;

  @Field()
  message: string;
}

@ObjectType()
export class PageShareLink {
  @Field()
  path: string;

  @Field()
  title: string;
}

@InputType()
export class CancelWorkspaceInviteInput {
  @Field()
  @IsString()
  inviteId: string;
}

@ObjectType()
export class CancelWorkspaceInviteResult {
  @Field()
  success: boolean;

  @Field()
  message: string;
}

@InputType()
export class SharePageInput {
  @Field()
  @IsEmail()
  email: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  noteId?: string;
}
