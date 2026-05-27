'use client';
/**
 * 服务健康 — Hooks（真实 API 检查）
 * @author Antigravity/Gemini
 * @author codex
 */
import { useEffect, useMemo, useState } from 'react';
import {
  getGatewayApiUrl,
  getGatewayPublicUrl,
  getPublicApiRouteMappings,
  type PublicApiSegment,
} from '@ai-quality-platform/shared-config';

export type HealthStatus = 'UNKNOWN' | 'CHECKING' | 'UP' | 'DOWN';

export interface HealthTarget {
  key: string;
  name: string;
  url: string;
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

const SERVICES: ReadonlyArray<{ key: string; name: string; apiSegment: PublicApiSegment }> = [
  { key: 'platform', name: 'quality-platform-service', apiSegment: 'system' },
  { key: 'execution', name: 'quality-execution-service', apiSegment: 'execution' },
];

function buildTargets(): HealthTarget[] {
  return [
    {
      key: 'gateway',
      name: 'quality-gateway',
      url: getGatewayPublicUrl('/ai-quality-platform/health.do'),
    },
    ...SERVICES.map((s) => ({
      key: s.key,
      name: s.name,
      url: getGatewayApiUrl(s.apiSegment, '/health.do'),
    })),
  ];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readDiagnostics(data: Record<string, unknown>): Pick<HealthResult, 'dependencies' | 'worker'> {
  const dependencies = asRecord(data.dependencies);
  const worker = asRecord(data.worker);
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
    worker: Object.keys(worker).length > 0
      ? {
        activeRunCount: typeof worker.activeRunCount === 'number' ? worker.activeRunCount : undefined,
        runningRunCount: typeof worker.runningRunCount === 'number' ? worker.runningRunCount : undefined,
        lastRecoveryStatus: typeof worker.lastRecoveryStatus === 'string' ? worker.lastRecoveryStatus : undefined,
      }
      : undefined,
  };
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
    const entries = await Promise.all(
      targets.map(async (t) => {
        const start = performance.now();
        try {
          const res = await fetch(t.url, { cache: 'no-store' });
          const payload = await res.json().catch(() => ({}));
          const data = payload.data ?? payload;
          const diagnostics = readDiagnostics(asRecord(data));
          const ok = res.ok && data.status === 'UP';
          return [
            t.key,
            {
              durationMs: Math.round(performance.now() - start),
              ...diagnostics,
              message: ok ? '健康检查通过' : (data.message ?? `HTTP ${res.status}`),
              status: ok ? 'UP' : 'DOWN',
            } satisfies HealthResult,
          ] as const;
        } catch (err) {
          return [
            t.key,
            {
              durationMs: Math.round(performance.now() - start),
              message: err instanceof Error ? err.message : '请求失败',
              status: 'DOWN',
            } satisfies HealthResult,
          ] as const;
        }
      }),
    );
    setResults(Object.fromEntries(entries));
    setLastCheckedAt(checkedAt.toLocaleString('zh-CN', { hour12: false }));
    setChecking(false);
  };

  return { targets, routeMappings, results, summary, lastCheckedAt, checking, checkAll };
}
