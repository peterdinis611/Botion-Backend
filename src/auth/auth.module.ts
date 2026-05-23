import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { GqlAuthGuard } from './gql-auth.guard';
import { HttpAuthGuard } from './http-auth.guard';

@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'SECRET_KEY_JWT_CHANGE_ME',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [AuthService, AuthResolver, GqlAuthGuard, HttpAuthGuard],
  exports: [AuthService, GqlAuthGuard, HttpAuthGuard],
})
export class AuthModule {}
