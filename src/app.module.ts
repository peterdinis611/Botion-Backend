import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { DrizzleModule } from './drizzle/drizzle.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CacheModule } from './cache/cache.module';
import { AppFeaturesModule } from './app/app-features.module';
import { EventsModule } from './events/events.module';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from './auth/current-user.decorator';
import type { Context } from 'graphql-ws';

@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [AuthModule],
      inject: [JwtService],
      useFactory: (jwtService: JwtService) => ({
        autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
        subscriptions: {
          'graphql-ws': {
            onConnect: async (context: Context) => {
              const params = context.connectionParams as
                | Record<string, string>
                | undefined;
              const raw =
                params?.authorization ?? params?.Authorization;
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
          connection?: { context?: { user?: JwtPayload; authorization?: string } };
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
})
export class AppModule {}
