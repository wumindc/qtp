import { Controller, Get } from '@nestjs/common';
import { GATEWAY_PORT } from '@ai-quality-platform/shared-config';
import { ok } from '@ai-quality-platform/shared-http';
import { buildGatewayTargetUrl } from './gateway-router';

type ServiceHealthStatus = 'UP' | 'DOWN';

interface InternalServiceHealth {
  dependencies?: Record<string, unknown>;
  message?: string;
  status: ServiceHealthStatus;
  worker?: Record<string, unknown>;
}

@Controller('ai-quality-platform')
export class HealthController {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  /**
   * @author codex
   * Aggregates internal service health so browsers never need service URLs.
   */
  @Get('health.do')
  async health() {
    const [platform, execution] = await Promise.all([
      this.probeInternalService('system', '/health.do'),
      this.probeInternalService('execution', '/health.do'),
    ]);
    const aggregateStatus: ServiceHealthStatus = platform.status === 'UP' && execution.status === 'UP' ? 'UP' : 'DOWN';

    return ok({
      service: 'quality-gateway',
      status: aggregateStatus,
      port: GATEWAY_PORT,
      services: {
        gateway: { status: 'UP' as const },
        platform,
        execution,
      },
      time: new Date().toISOString(),
    });
  }

  private async probeInternalService(segment: 'system' | 'execution', path: string): Promise<InternalServiceHealth> {
    try {
      const response = await this.fetchImpl(buildGatewayTargetUrl(segment, path));
      const payload = await response.json().catch(() => ({}));
      const data = this.asRecord(this.asRecord(payload).data ?? payload);
      const status: ServiceHealthStatus = response.ok && data.status === 'UP' ? 'UP' : 'DOWN';
      return {
        dependencies: this.optionalRecord(data.dependencies),
        message: typeof data.message === 'string' ? data.message : undefined,
        status,
        worker: this.optionalRecord(data.worker),
      };
    } catch (error) {
      return {
        message: error instanceof Error ? error.message : '内部服务健康检查失败',
        status: 'DOWN',
      };
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }

  private optionalRecord(value: unknown): Record<string, unknown> | undefined {
    const record = this.asRecord(value);
    return Object.keys(record).length > 0 ? record : undefined;
  }
}
