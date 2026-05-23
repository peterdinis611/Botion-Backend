import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { NotificationsService } from './notifications.service';
import { Notification } from './notification.model';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../../auth/gql-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { JwtPayload } from '../../auth/current-user.decorator';

@Resolver(() => Notification)
@UseGuards(GqlAuthGuard)
export class NotificationsResolver {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Query(() => [Notification], { name: 'notifications' })
  async getNotifications(@CurrentUser() currentUser: JwtPayload) {
    return this.notificationsService.findAll(currentUser.sub);
  }

  @Mutation(() => Notification)
  async markNotificationAsRead(
    @CurrentUser() currentUser: JwtPayload,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.notificationsService.markAsRead(id, currentUser.sub);
  }

  @Mutation(() => Boolean)
  async markAllNotificationsAsRead(@CurrentUser() currentUser: JwtPayload) {
    return this.notificationsService.markAllAsRead(currentUser.sub);
  }
}
