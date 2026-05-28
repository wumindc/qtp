import { Controller, Get } from '@nestjs/common';
import { getServicePort } from '@ai-quality-platform/shared-config';
import { ok } from '@ai-quality-platform/shared-http';

@Controller('ai-quality-platform')
export class HealthController {
  /**
   * @author codex
   * Returns the internal AI invocation service health shape.
   */
  @Get('health.do')
  async health() {
    return ok({
      service: 'quality-ai-invocation-service',
      status: 'UP',
      port: getServicePort('aiInvocation'),
      time: new Date().toISOString(),
    });
  }
}
