import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ProviderController } from './provider.controller';

@Module({
  controllers: [HealthController, ProviderController],
})
export class AppModule {}
