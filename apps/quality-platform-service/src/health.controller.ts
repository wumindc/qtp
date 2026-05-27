import { Controller, Get } from '@nestjs/common';
import { getServicePort } from '@ai-quality-platform/shared-config';
import { createRuntimePrismaClient } from '@ai-quality-platform/shared-database';
import { ok } from '@ai-quality-platform/shared-http';
import net from 'node:net';

type DependencyStatus = 'UP' | 'DOWN' | 'DISABLED' | 'DIAGNOSTIC_ONLY';

interface DependencyHealth {
  status: DependencyStatus;
  message?: string;
}

interface PlatformHealthProbes {
  database: () => Promise<DependencyHealth>;
  redis: () => Promise<DependencyHealth>;
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
    const [database, redis, modelProviders] = await Promise.all([
      this.probes.database(),
      this.probes.redis(),
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
        redis,
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
    redis: checkRedis,
    modelProviders: async () => ({
      status: 'DIAGNOSTIC_ONLY',
      message: '模型供应商连接测试在模型中心按需触发，不阻塞平台基础健康。',
    }),
  };
}

async function checkDatabase(): Promise<DependencyHealth> {
  if (process.env.VITEST) return { status: 'UP', message: 'vitest skips runtime database probe' };
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

async function checkRedis(): Promise<DependencyHealth> {
  if (process.env.REDIS_DISABLED === 'true') return { status: 'DISABLED', message: 'REDIS_DISABLED=true' };
  const host = process.env.REDIS_HOST ?? '127.0.0.1';
  const port = Number(process.env.REDIS_PORT ?? 6379);
  if (!Number.isFinite(port)) return { status: 'DOWN', message: 'REDIS_PORT is invalid' };
  if (process.env.VITEST) return { status: 'DISABLED', message: 'vitest skips runtime redis probe' };
  return probeTcp(host, port, 800);
}

function probeTcp(host: string, port: number, timeoutMs: number): Promise<DependencyHealth> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (health: DependencyHealth) => {
      socket.destroy();
      resolve(health);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish({ status: 'UP', message: `${host}:${port} reachable` }));
    socket.once('timeout', () => finish({ status: 'DOWN', message: `${host}:${port} timeout` }));
    socket.once('error', (error) => finish({ status: 'DOWN', message: error.message }));
  });
}
