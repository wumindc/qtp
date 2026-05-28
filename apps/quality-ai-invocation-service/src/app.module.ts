import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ModelInvocationController } from './model-invocation.controller';

@Module({
  controllers: [HealthController, ModelInvocationController],
})
export class AppModule {}
