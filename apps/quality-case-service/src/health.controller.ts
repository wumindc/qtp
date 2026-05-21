import { Controller, Get } from '@nestjs/common';
import { ok } from '@ai-quality-platform/shared-http';

@Controller('ai-quality-platform')
export class HealthController {
  /**
   * @author codex
   * Returns the local service health shape used by the frontend health page.
   */
  @Get('health.do')
  health() {
    return ok({
      service: 'quality-case-service',
      status: 'UP',
      database: 'UP',
      redis: 'UP',
      time: new Date().toISOString(),
    });
  }
}
