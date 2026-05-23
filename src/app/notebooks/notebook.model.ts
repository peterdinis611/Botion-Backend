import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../../users/user.model';
import { Note } from '../notes/note.model';
import { Folder } from '../folders/folder.model';

@ObjectType()
export class Notebook {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  color: string;

  @Field()
  sortOrder: number;

  @Field()
  userId: string;

  @Field(() => ID, { nullable: true })
  folderId?: string;

  @Field(() => Folder, { nullable: true })
  folder?: Folder;

  @Field(() => User, { nullable: true })
  user?: User;

  @Field(() => [Note], { nullable: true })
  notes?: Note[];

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
