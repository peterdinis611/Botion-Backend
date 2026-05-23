import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../users/user.model';

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

  @Field(() => User, { nullable: true })
  user?: User;

  @Field()
  createdAt: string;
}
