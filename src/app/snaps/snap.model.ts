import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Snap {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  caption?: string;

  @Field()
  fileId: string;

  @Field()
  mimeType: string;

  @Field({ nullable: true })
  notebookId?: string;

  @Field({ nullable: true })
  noteId?: string;

  @Field()
  sortOrder: number;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
