import { Module } from '@nestjs/common';
import { ExecutionController } from './execution.controller';
import { HealthController } from './health.controller';

@Module({
  controllers: [ExecutionController, HealthController],
})
export class AppModule {}
