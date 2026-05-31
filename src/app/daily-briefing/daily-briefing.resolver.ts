import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { DailyBriefing } from './daily-briefing.model';
import { DailyBriefingService } from './daily-briefing.service';
import { GqlAuthGuard } from '../../auth/gql-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { JwtPayload } from '../../auth/current-user.decorator';

@Resolver(() => DailyBriefing)
@UseGuards(GqlAuthGuard)
export class DailyBriefingResolver {
  constructor(private readonly dailyBriefingService: DailyBriefingService) {}

  @Query(() => DailyBriefing, { name: 'dailyBriefing' })
  dailyBriefing(
    @CurrentUser() currentUser: JwtPayload,
    @Args('date', { type: () => String }) date: string,
  ) {
    return this.dailyBriefingService.getBriefing(currentUser.sub, date);
  }
}
