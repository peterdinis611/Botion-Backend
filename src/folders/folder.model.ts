import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../users/user.model';
import { Notebook } from '../notebooks/notebook.model';

@ObjectType()
export class Folder {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  color: string;

  @Field()
  userId: string;

  @Field(() => User, { nullable: true })
  user?: User;

  @Field(() => [Notebook], { nullable: true })
  notebooks?: Notebook[];

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
