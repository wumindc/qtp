'use client';
/**
 * 服务健康 — Hooks（真实 API 检查）
 * @author Antigravity/Gemini
 */
import { useMemo, useState } from 'react';
import { getGatewayApiUrl, CONTEXT_PATH, GATEWAY_PORT } from '@ai-quality-platform/shared-config';

export type HealthStatus = 'UNKNOWN' | 'CHECKING' | 'UP' | 'DOWN';

export interface HealthTarget {
  key: string;
  name: string;
  url: string;
}

export interface HealthResult {
  durationMs?: number;
  message?: string;
  status: HealthStatus;
}

const SERVICES = [
  { key: 'business', name: 'quality-business-service' },
  { key: 'case', name: 'quality-case-service' },
  { key: 'plan', name: 'quality-plan-service' },
  { key: 'execution', name: 'quality-execution-service' },
  { key: 'ai', name: 'quality-ai-service' },
  { key: 'review', name: 'quality-review-service' },
  { key: 'statistics', name: 'quality-statistics-service' },
  { key: 'system', name: 'quality-system-service' },
] as const;

export function useHealthCheck() {
  const targets: HealthTarget[] = useMemo(
    () => [
      {
        key: 'gateway',
        name: 'quality-gateway',
        url: `http://127.0.0.1:${GATEWAY_PORT}/${CONTEXT_PATH}/health.do`,
      },
      ...SERVICES.map((s) => ({
        key: s.key,
        name: s.name,
        url: getGatewayApiUrl(s.key, '/health.do'),
      })),
    ],
    [],
  );

  const [results, setResults] = useState<Record<string, HealthResult>>({});
  const [lastCheckedAt, setLastCheckedAt] = useState('');
  const [checking, setChecking] = useState(false);

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
          const ok = res.ok && data.status === 'UP';
          return [
            t.key,
            {
              durationMs: Math.round(performance.now() - start),
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

  return { targets, results, summary, lastCheckedAt, checking, checkAll };
}
