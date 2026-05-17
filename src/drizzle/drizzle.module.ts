import { Module, Global } from '@nestjs/common';
import { drizzleProvider, DRIZZLE } from './drizzle.provider';

@Global()
@Module({
  providers: [drizzleProvider],
  exports: [DRIZZLE],
})
export class DrizzleModule {}
