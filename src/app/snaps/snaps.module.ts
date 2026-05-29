import { Module } from '@nestjs/common';
import { SnapsService } from './snaps.service';
import { SnapsResolver } from './snaps.resolver';
import { FilesModule } from '../files/files.module';
import { AuthModule } from '../../auth/auth.module';
import { CacheModule } from '../../cache/cache.module';

@Module({
  imports: [FilesModule, AuthModule, CacheModule],
  providers: [SnapsService, SnapsResolver],
  exports: [SnapsService],
})
export class SnapsModule {}
