import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { GqlAuthGuard } from './gql-auth.guard';
import { HttpAuthGuard } from './http-auth.guard';
import { JWT_EXPIRES_IN_SECONDS, JWT_SECRET } from './jwt.config';

@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      global: true,
      secret: JWT_SECRET,
      signOptions: { expiresIn: JWT_EXPIRES_IN_SECONDS },
    }),
  ],
  providers: [AuthService, AuthResolver, GqlAuthGuard, HttpAuthGuard],
  exports: [AuthService, GqlAuthGuard, HttpAuthGuard],
})
export class AuthModule {}
