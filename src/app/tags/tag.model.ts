import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { User } from '../../users/user.model';

@ObjectType()
export class Tag {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  color: string;

  @Field()
  userId: string;

  @Field({ nullable: true })
  notebookId?: string;

  @Field(() => Int)
  sortOrder: number;

  @Field(() => Int)
  noteCount: number;

  @Field(() => User, { nullable: true })
  user?: User;

  @Field()
  createdAt: string;
}
