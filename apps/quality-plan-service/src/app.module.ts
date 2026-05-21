import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PlanController } from './plan.controller';

@Module({
  controllers: [HealthController, PlanController],
})
export class AppModule {}
