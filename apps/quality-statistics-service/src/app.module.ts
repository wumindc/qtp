import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ReportController } from './report.controller';

@Module({
  controllers: [HealthController, ReportController],
})
export class AppModule {}
