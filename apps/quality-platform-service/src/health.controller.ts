import { Controller, Get } from '@nestjs/common';
import { getServicePort } from '@ai-quality-platform/shared-config';
import { createRuntimePrismaClient } from '@ai-quality-platform/shared-database';
import { ok } from '@ai-quality-platform/shared-http';

type DependencyStatus = 'UP' | 'DOWN' | 'DISABLED' | 'DIAGNOSTIC_ONLY';

interface DependencyHealth {
  status: DependencyStatus;
  message?: string;
}

interface PlatformHealthProbes {
  database: () => Promise<DependencyHealth>;
  modelProviders: () => Promise<DependencyHealth>;
}

@Controller('ai-quality-platform')
export class HealthController {
  constructor(private readonly probes: PlatformHealthProbes = createDefaultPlatformHealthProbes()) {}

  /**
   * @author codex
   * Returns the consolidated platform service health shape.
   */
  @Get('health.do')
  async health() {
    const [database, modelProviders] = await Promise.all([
      this.probes.database(),
      this.probes.modelProviders(),
    ]);
    const hardDependencies = [database];
    const status = hardDependencies.every((dependency) => dependency.status === 'UP') ? 'UP' : 'DOWN';

    return ok({
      service: 'quality-platform-service',
      status,
      port: getServicePort('platform'),
      dependencies: {
        database,
        modelProviders,
      },
      time: new Date().toISOString(),
    });
  }
}

/**
 * @author codex
 * Builds runtime dependency probes while keeping tests injectable.
 */
function createDefaultPlatformHealthProbes(): PlatformHealthProbes {
  return {
    database: checkDatabase,
    modelProviders: async () => ({
      status: 'DIAGNOSTIC_ONLY',
      message: '模型供应商连接测试通过内部 AI 调用服务按需触发，不阻塞平台基础健康。',
    }),
  };
}

async function checkDatabase(): Promise<DependencyHealth> {
  let prisma: { $queryRawUnsafe(query: string): Promise<unknown>; $disconnect(): Promise<void> } | undefined;
  try {
    prisma = await createRuntimePrismaClient<{ $queryRawUnsafe(query: string): Promise<unknown>; $disconnect(): Promise<void> }>();
    await prisma.$queryRawUnsafe('SELECT 1');
    return { status: 'UP', message: 'SELECT 1 ok' };
  } catch (error) {
    return { status: 'DOWN', message: error instanceof Error ? error.message : 'database probe failed' };
  } finally {
    await prisma?.$disconnect().catch(() => undefined);
  }
}
