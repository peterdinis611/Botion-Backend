import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../users/user.model';
import { Note } from './note.model';

@ObjectType()
export class NoteShare {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  noteId: string;

  @Field(() => ID)
  sharedWithUserId: string;

  @Field()
  permission: string; // 'READ' or 'WRITE'

  @Field()
  createdAt: string;

  @Field(() => User, { nullable: true })
  sharedWithUser?: User;

  @Field(() => Note, { nullable: true })
  note?: Note;
}
