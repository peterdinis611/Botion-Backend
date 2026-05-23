import { Resolver, Subscription, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Notification } from '../app/notifications/notification.model';
import { AppEvent } from './app-event.model';
import { AppEventAction } from './app-event-action.enum';
import { EventsPubSubService } from './events-pub-sub.service';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/current-user.decorator';

@Resolver()
@UseGuards(GqlAuthGuard)
export class EventsResolver {
  constructor(private readonly eventsPubSub: EventsPubSubService) {}

  @Subscription(() => Notification, {
    name: 'notificationAdded',
    resolve: (payload: { notificationAdded: Notification }) =>
      payload.notificationAdded,
  })
  notificationAdded(@CurrentUser() currentUser: JwtPayload) {
    return this.eventsPubSub.notificationIterator(currentUser.sub);
  }

  @Subscription(() => AppEvent, {
    name: 'appEvent',
    resolve: (payload: { appEvent: AppEvent }) => payload.appEvent,
    filter: (
      payload: { appEvent: AppEvent },
      variables: { actions?: AppEventAction[] },
      context: { req: { user: JwtPayload } },
    ) => {
      const event = payload.appEvent;
      if (event.userId !== context.req.user.sub) {
        return false;
      }
      if (variables.actions?.length) {
        return variables.actions.includes(event.action);
      }
      return true;
    },
  })
  appEvent(
    @CurrentUser() currentUser: JwtPayload,
    @Args('actions', { type: () => [AppEventAction], nullable: true })
    actions?: AppEventAction[],
  ) {
    void actions;
    return this.eventsPubSub.appEventIterator(currentUser.sub);
  }
}
