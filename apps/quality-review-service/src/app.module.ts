import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ReviewController } from './review.controller';

@Module({
  controllers: [HealthController, ReviewController],
})
export class AppModule {}
