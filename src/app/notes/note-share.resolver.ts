import { Resolver, ResolveField, Parent } from '@nestjs/graphql';
import { NoteShare } from './note-share.model';
import { User } from '../../users/user.model';
import { UsersService } from '../../users/users.service';

@Resolver(() => NoteShare)
export class NoteShareResolver {
  constructor(private readonly usersService: UsersService) {}

  @ResolveField(() => User, { nullable: true })
  async sharedWithUser(@Parent() share: NoteShare) {
    try {
      return await this.usersService.findOne(share.sharedWithUserId);
    } catch {
      return null;
    }
  }
}
