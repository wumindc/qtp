'use client';
/**
 * 服务健康 — Hooks（真实 API 检查）
 * @author Antigravity/Gemini
 * @author codex
 */
import { useEffect, useMemo, useState } from 'react';
import {
  getGatewayPublicUrl,
  getPublicApiRouteMappings,
} from '@ai-quality-platform/shared-config';

export type HealthStatus = 'UNKNOWN' | 'CHECKING' | 'UP' | 'DOWN';

export interface HealthTarget {
  key: string;
  name: string;
}

export interface HealthResult {
  dependencies?: Record<string, { status?: string; message?: string }>;
  durationMs?: number;
  message?: string;
  status: HealthStatus;
  worker?: {
    activeRunCount?: number;
    runningRunCount?: number;
    lastRecoveryStatus?: string;
  };
}

const SERVICES: ReadonlyArray<HealthTarget> = [
  { key: 'gateway', name: 'quality-gateway' },
  { key: 'platform', name: 'quality-platform-service' },
  { key: 'execution', name: 'quality-execution-service' },
  { key: 'aiInvocation', name: 'quality-ai-invocation-service' },
];

function buildTargets(): HealthTarget[] {
  return [...SERVICES];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function readNumber(value: unknown, message: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(message);
  }
  return value;
}

function readOptionalNumber(value: unknown, message: string) {
  if (value === undefined || value === null) return undefined;
  return readNumber(value, message);
}

function readWorkerDiagnostics(data: Record<string, unknown>, requireCounters: boolean): HealthResult['worker'] {
  const rawWorker = data.worker;
  if (rawWorker === undefined || rawWorker === null) {
    if (requireCounters) throw new Error('执行服务健康响应缺少 Worker 诊断信息');
    return undefined;
  }
  if (!isRecord(rawWorker)) {
    throw new Error('执行服务健康响应 Worker 诊断格式不正确');
  }
  return {
    activeRunCount: requireCounters
      ? readNumber(rawWorker.activeRunCount, '执行服务健康响应缺少 Worker 活跃数量')
      : readOptionalNumber(rawWorker.activeRunCount, '执行服务健康响应 Worker 活跃数量格式不正确'),
    runningRunCount: requireCounters
      ? readNumber(rawWorker.runningRunCount, '执行服务健康响应缺少 Worker 运行数量')
      : readOptionalNumber(rawWorker.runningRunCount, '执行服务健康响应 Worker 运行数量格式不正确'),
    lastRecoveryStatus: typeof rawWorker.lastRecoveryStatus === 'string' ? rawWorker.lastRecoveryStatus : undefined,
  };
}

function readDiagnostics(data: Record<string, unknown>, requireWorkerCounters = false): Pick<HealthResult, 'dependencies' | 'worker'> {
  const dependencies = asRecord(data.dependencies);
  return {
    dependencies: Object.keys(dependencies).length > 0
      ? Object.fromEntries(Object.entries(dependencies).map(([key, value]) => {
        const item = asRecord(value);
        return [key, {
          status: typeof item.status === 'string' ? item.status : undefined,
          message: typeof item.message === 'string' ? item.message : undefined,
        }];
      }))
      : undefined,
    worker: readWorkerDiagnostics(data, requireWorkerCounters),
  };
}

function readAggregatedServices(data: Record<string, unknown>, durationMs: number): Record<string, HealthResult> {
  const services = asRecord(data.services);
  return Object.fromEntries(SERVICES.map((service) => {
    const serviceData = asRecord(services[service.key]);
    const status = serviceData.status === 'UP' ? 'UP' : serviceData.status === 'DOWN' ? 'DOWN' : 'UNKNOWN';
    try {
      return [service.key, {
        durationMs: service.key === 'gateway' ? durationMs : readOptionalNumber(serviceData.durationMs, '忽略'),
        ...readDiagnostics(serviceData, service.key === 'execution' && status === 'UP'),
        message: status === 'UP' ? '健康检查通过' : (typeof serviceData.message === 'string' ? serviceData.message : '等待聚合检查'),
        status,
      } satisfies HealthResult];
    } catch (error: unknown) {
      return [service.key, {
        durationMs: service.key === 'gateway' ? durationMs : readOptionalNumber(serviceData.durationMs, '忽略'),
        message: error instanceof Error ? error.message : '服务健康响应格式不正确',
        status: 'DOWN',
      } satisfies HealthResult];
    }
  }));
}

export function useHealthCheck() {
  const [targets, setTargets] = useState<HealthTarget[]>([]);
  const routeMappings = useMemo(() => getPublicApiRouteMappings(), []);

  const [results, setResults] = useState<Record<string, HealthResult>>({});
  const [lastCheckedAt, setLastCheckedAt] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setTargets(buildTargets());
  }, []);

  const summary = targets.reduce(
    (acc, t) => {
      const status = results[t.key]?.status ?? 'UNKNOWN';
      return {
        up: acc.up + (status === 'UP' ? 1 : 0),
        down: acc.down + (status === 'DOWN' ? 1 : 0),
        unknown: acc.unknown + (status === 'UNKNOWN' || status === 'CHECKING' ? 1 : 0),
      };
    },
    { up: 0, down: 0, unknown: 0 },
  );

  const checkAll = async () => {
    setChecking(true);
    setResults(
      Object.fromEntries(targets.map((t) => [t.key, { status: 'CHECKING' as const }])),
    );
    const checkedAt = new Date();
    const start = performance.now();
    try {
      const res = await fetch(getGatewayPublicUrl('/ai-quality-platform/health.do'), { cache: 'no-store' });
      let payload: unknown;
      try {
        payload = await res.json();
      } catch {
        throw new Error('健康检查返回非法 JSON');
      }
      const payloadRecord = asRecord(payload);
      const data = asRecord(payloadRecord.data ?? payload);
      setResults(readAggregatedServices(data, Math.round(performance.now() - start)));
    } catch (err) {
      setResults(Object.fromEntries(targets.map((t) => [t.key, {
        durationMs: t.key === 'gateway' ? Math.round(performance.now() - start) : undefined,
        message: err instanceof Error ? err.message : '请求失败',
        status: 'DOWN' as const,
      }])));
    }
    setLastCheckedAt(checkedAt.toLocaleString('zh-CN', { hour12: false }));
    setChecking(false);
  };

  return { targets, routeMappings, results, summary, lastCheckedAt, checking, checkAll };
}
