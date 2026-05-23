import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../../users/user.model';

@ObjectType()
export class CalendarEvent {
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
  startAt: string;

  @Field()
  endAt: string;

  @Field()
  allDay: boolean;

  @Field()
  color: string;

  @Field({ nullable: true })
  location?: string;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
