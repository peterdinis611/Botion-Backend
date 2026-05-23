import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../../users/user.model';

@ObjectType()
export class Graph {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  userId: string;

  @Field(() => User, { nullable: true })
  user?: User;

  @Field()
  nodesJson: string;

  @Field()
  edgesJson: string;

  @Field({ nullable: true })
  viewportJson?: string;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
