import { Controller, Get } from '@nestjs/common';
import { GATEWAY_PORT } from '@ai-quality-platform/shared-config';
import { ok } from '@ai-quality-platform/shared-http';

@Controller('ai-quality-platform')
export class HealthController {
  /**
   * @author codex
   * Returns gateway health for the single public backend entry.
   */
  @Get('health.do')
  health() {
    return ok({
      service: 'quality-gateway',
      status: 'UP',
      port: GATEWAY_PORT,
      time: new Date().toISOString(),
    });
  }
}
