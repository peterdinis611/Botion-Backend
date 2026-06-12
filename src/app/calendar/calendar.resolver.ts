import {
  Resolver,
  Query,
  Mutation,
  Args,
  ResolveField,
  Parent,
  ID,
  Directive,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarEvent } from './calendar-event.model';
import {
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from './calendar.dto';
import { User } from '../../users/user.model';
import { UsersService } from '../../users/users.service';
import { GqlAuthGuard } from '../../auth/gql-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { JwtPayload } from '../../auth/current-user.decorator';

@Resolver(() => CalendarEvent)
@UseGuards(GqlAuthGuard)
export class CalendarResolver {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly usersService: UsersService,
  ) {}

  @Directive('@cacheControl(maxAge: 60, scope: PRIVATE)')
  @Query(() => [CalendarEvent], { name: 'calendarEvents' })
  async getCalendarEvents(
    @CurrentUser() currentUser: JwtPayload,
    @Args('from', { type: () => String, nullable: true }) from?: string,
    @Args('to', { type: () => String, nullable: true }) to?: string,
  ) {
    return this.calendarService.findAll(currentUser.sub, { from, to });
  }

  @Query(() => CalendarEvent, { name: 'calendarEvent' })
  async getCalendarEvent(
    @CurrentUser() currentUser: JwtPayload,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.calendarService.findOne(id, currentUser.sub);
  }

  @Mutation(() => CalendarEvent)
  async createCalendarEvent(
    @CurrentUser() currentUser: JwtPayload,
    @Args('input') input: CreateCalendarEventInput,
  ) {
    return this.calendarService.create(input, currentUser.sub);
  }

  @Mutation(() => CalendarEvent)
  async updateCalendarEvent(
    @CurrentUser() currentUser: JwtPayload,
    @Args('input') input: UpdateCalendarEventInput,
  ) {
    return this.calendarService.update(input, currentUser.sub);
  }

  @Mutation(() => Boolean)
  async removeCalendarEvent(
    @CurrentUser() currentUser: JwtPayload,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.calendarService.remove(id, currentUser.sub);
  }

  @ResolveField(() => User)
  async user(@Parent() event: CalendarEvent) {
    return this.usersService.findOne(event.userId);
  }
}
