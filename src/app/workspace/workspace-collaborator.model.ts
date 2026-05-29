import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum CollaboratorStatus {
  SELF = 'SELF',
  MEMBER = 'MEMBER',
  PENDING_INVITE = 'PENDING_INVITE',
  NOTE_COLLABORATOR = 'NOTE_COLLABORATOR',
}

registerEnumType(CollaboratorStatus, { name: 'CollaboratorStatus' });

@ObjectType()
export class WorkspaceCollaborator {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  name?: string;

  @Field()
  email: string;

  @Field(() => CollaboratorStatus)
  status: CollaboratorStatus;

  @Field({ nullable: true })
  permission?: string;

  @Field({ nullable: true })
  noteId?: string;
}
