import { Controller, Get } from '@nestjs/common';
import { ok } from '@ai-quality-platform/shared-http';
import { ExecutionService, type WorkerHealth } from './execution.service';

interface ExecutionHealthService {
  getWorkerHealth(): Promise<WorkerHealth>;
}

@Controller('ai-quality-platform')
export class HealthController {
  constructor(private readonly executionService: ExecutionHealthService = new ExecutionService()) {}

  /**
   * @author codex
   * Returns the local service health shape used by the frontend health page.
   */
  @Get('health.do')
  async health() {
    try {
      const worker = await this.executionService.getWorkerHealth();

      return ok({
        service: 'quality-execution-service',
        status: 'UP',
        worker,
        time: new Date().toISOString(),
      });
    } catch (error) {
      return ok({
        service: 'quality-execution-service',
        status: 'DOWN',
        message: error instanceof Error ? error.message : '执行服务健康检查失败',
        time: new Date().toISOString(),
      });
    }
  }
}
