import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Notification {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field()
  type: string;

  @Field()
  message: string;

  @Field(() => String, { nullable: true })
  metadata?: string | null;

  @Field()
  isRead: boolean;

  @Field()
  createdAt: string;
}
