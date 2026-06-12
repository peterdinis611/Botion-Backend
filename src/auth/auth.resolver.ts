import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterInput, LoginInput, AuthPayload } from './auth.dto';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ auth: { limit: 5, ttl: 600_000 } })
  @Mutation(() => AuthPayload)
  async register(@Args('input') input: RegisterInput) {
    return this.authService.register(input);
  }

  @Throttle({ auth: { limit: 10, ttl: 600_000 } })
  @Mutation(() => AuthPayload)
  async login(@Args('input') input: LoginInput) {
    return this.authService.login(input);
  }

  @Throttle({ demo: { limit: 3, ttl: 3_600_000 } })
  @Mutation(() => AuthPayload, {
    description: 'Create a temporary demo workspace with sample content.',
  })
  async createDemoAccount() {
    return this.authService.createDemoAccount();
  }
}
