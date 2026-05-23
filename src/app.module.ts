import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DrizzleModule } from './drizzle/drizzle.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { NotesModule } from './notes/notes.module';
import { NotebooksModule } from './notebooks/notebooks.module';
import { TagsModule } from './tags/tags.module';
import { CacheModule } from './cache/cache.module';
import { FoldersModule } from './folders/folders.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      context: ({ req }) => ({ req }),
    }),
    DrizzleModule,
    UsersModule,
    AuthModule,
    NotesModule,
    NotebooksModule,
    TagsModule,
    CacheModule,
    FoldersModule,
    NotificationsModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

