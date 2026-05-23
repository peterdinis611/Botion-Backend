import { ObjectType, Field, ID, registerEnumType, Int } from '@nestjs/graphql';
import { UserPreferences } from './user-preferences.model';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

registerEnumType(UserRole, { name: 'UserRole' });
registerEnumType(UserStatus, { name: 'UserStatus' });

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field(() => UserRole)
  role: UserRole;

  @Field(() => UserStatus)
  status: UserStatus;

  @Field({ nullable: true })
  bio?: string;

  @Field(() => Int, { nullable: true })
  age?: number;

  @Field(() => UserPreferences)
  preferences: UserPreferences;

  @Field()
  createdAt: string;
}
