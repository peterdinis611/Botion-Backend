import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ThrottlerModule } from '@nestjs/throttler';
import responseCachePlugin from '@apollo/server-plugin-response-cache';
import { join } from 'path';
import { DrizzleModule } from './drizzle/drizzle.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CacheModule } from './cache/cache.module';
import { AppFeaturesModule } from './app/app-features.module';
import { EventsModule } from './events/events.module';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from './auth/current-user.decorator';
import { GqlThrottlerGuard } from './auth/gql-throttler.guard';
import type { Context } from 'graphql-ws';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 180 },
      { name: 'auth', ttl: 600_000, limit: 10 },
      { name: 'demo', ttl: 3_600_000, limit: 3 },
    ]),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [AuthModule],
      inject: [JwtService],
      useFactory: (jwtService: JwtService) => ({
        autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
        plugins: [
          responseCachePlugin({
            sessionId: async (requestContext) => {
              const user = (
                requestContext.contextValue as
                  | { req?: { user?: JwtPayload } }
                  | undefined
              )?.req?.user;
              return user?.sub ?? null;
            },
          }),
        ],
        subscriptions: {
          'graphql-ws': {
            onConnect: async (context: Context) => {
              const params = context.connectionParams as
                | Record<string, string>
                | undefined;
              const raw = params?.authorization ?? params?.Authorization;
              if (!raw) {
                throw new Error('Missing authorization in connectionParams.');
              }
              const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;
              const user = await jwtService.verifyAsync<JwtPayload>(token);
              return {
                user,
                authorization: `Bearer ${token}`,
              };
            },
          },
        },
        context: ({
          req,
          connection,
        }: {
          req?: { headers?: { authorization?: string }; user?: JwtPayload };
          connection?: {
            context?: { user?: JwtPayload; authorization?: string };
          };
        }) => {
          if (connection?.context?.user) {
            return {
              req: {
                user: connection.context.user,
                headers: {
                  authorization: connection.context.authorization,
                },
              },
              connectionParams: {
                authorization: connection.context.authorization,
              },
              user: connection.context.user,
            };
          }
          return { req };
        },
      }),
    }),
    DrizzleModule,
    UsersModule,
    AuthModule,
    CacheModule,
    EventsModule,
    AppFeaturesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: GqlThrottlerGuard }],
})
export class AppModule {}
