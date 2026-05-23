import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class NoteRevision {
  @Field(() => ID)
  id: string;

  @Field()
  noteId: string;

  @Field()
  title: string;

  @Field()
  content: string;

  @Field()
  createdAt: string;
}
