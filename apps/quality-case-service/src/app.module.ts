import { Module } from '@nestjs/common';
import { CaseController } from './case.controller';
import { HealthController } from './health.controller';

@Module({
  controllers: [CaseController, HealthController],
})
export class AppModule {}
