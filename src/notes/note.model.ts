import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../users/user.model';
import { Notebook } from '../notebooks/notebook.model';
import { Tag } from '../tags/tag.model';
import { NoteRevision } from './note-revision.model';

@ObjectType()
export class Note {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  content: string;

  @Field()
  userId: string;

  @Field(() => User, { nullable: true })
  user?: User;

  @Field({ nullable: true })
  notebookId?: string;

  @Field(() => Notebook, { nullable: true })
  notebook?: Notebook;

  @Field()
  color: string;

  @Field()
  isArchived: boolean;

  @Field()
  isPinned: boolean;

  @Field(() => [Tag], { nullable: true })
  tags?: Tag[];

  @Field(() => [NoteRevision], { nullable: true })
  revisions?: NoteRevision[];

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
