import { Module } from '@nestjs/common';
import { GraphsService } from './graphs.service';
import { GraphsResolver } from './graphs.resolver';
import { UsersModule } from '../../users/users.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [UsersModule, AuthModule],
  providers: [GraphsService, GraphsResolver],
  exports: [GraphsService],
})
export class GraphsModule {}
