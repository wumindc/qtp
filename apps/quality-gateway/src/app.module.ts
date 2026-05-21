import { Module } from '@nestjs/common';
import { GatewayController } from './gateway.controller';
import { HealthController } from './health.controller';

@Module({
  controllers: [GatewayController, HealthController],
})
export class AppModule {}
