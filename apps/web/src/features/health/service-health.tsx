'use client';

import { useMemo, useState } from 'react';
import { getGatewayApiUrl, getGatewayPublicUrl } from '@ai-quality-platform/shared-config';
import { Activity, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';

export const HEALTH_SERVICES = [
  { key: 'business', name: 'quality-business-service' },
  { key: 'case', name: 'quality-case-service' },
  { key: 'plan', name: 'quality-plan-service' },
  { key: 'execution', name: 'quality-execution-service' },
  { key: 'ai', name: 'quality-ai-service' },
  { key: 'review', name: 'quality-review-service' },
  { key: 'statistics', name: 'quality-statistics-service' },
  { key: 'system', name: 'quality-system-service' },
] as const;

type HealthStatus = 'UNKNOWN' | 'CHECKING' | 'UP' | 'DOWN';

interface HealthResult {
  durationMs?: number;
  message?: string;
  status: HealthStatus;
}

const UNKNOWN_RESULT: HealthResult = { status: 'UNKNOWN' };

function getGatewayHealthUrl() {
  return getGatewayPublicUrl('/ai-quality-platform/health.do');
}

function getStatusLabel(status: HealthStatus) {
  if (status === 'UP') return 'UP';
  if (status === 'DOWN') return '异常';
  if (status === 'CHECKING') return '检查中';
  return '待检测';
}

function getStatusIcon(status: HealthStatus) {
  if (status === 'UP') return CheckCircle2;
  if (status === 'DOWN') return XCircle;
  return Activity;
}

/**
 * @author codex
 * Provides real gateway health probes and records the latest manual check time.
 */
export function HealthPage() {
  const targets = useMemo(
    () => [
      { key: 'gateway', name: 'quality-gateway', url: getGatewayHealthUrl() },
      ...HEALTH_SERVICES.map((service) => ({
        ...service,
        url: getGatewayApiUrl(service.key, '/health.do'),
      })),
    ],
    [],
  );
  const [results, setResults] = useState<Record<string, HealthResult>>({});
  const [lastCheckedAt, setLastCheckedAt] = useState('');
  const [checking, setChecking] = useState(false);

  const summary = targets.reduce(
    (current, target) => {
      const status = results[target.key]?.status ?? 'UNKNOWN';
      return {
        up: current.up + (status === 'UP' ? 1 : 0),
        down: current.down + (status === 'DOWN' ? 1 : 0),
        unknown: current.unknown + (status === 'UNKNOWN' ? 1 : 0),
      };
    },
    { up: 0, down: 0, unknown: 0 },
  );

  const checkHealth = async () => {
    setChecking(true);
    setResults(Object.fromEntries(targets.map((target) => [target.key, { status: 'CHECKING' as const }])));
    const checkedAt = new Date();
    const nextEntries = await Promise.all(
      targets.map(async (target) => {
        const start = performance.now();
        try {
          const response = await fetch(target.url, { cache: 'no-store' });
          const payload = await response.json().catch(() => ({}));
          const data = payload.data ?? payload;
          const healthy = response.ok && data.status === 'UP';
          return [
            target.key,
            {
              durationMs: Math.round(performance.now() - start),
              message: healthy ? '健康检查通过' : data.message ?? `HTTP ${response.status}`,
              status: healthy ? 'UP' : 'DOWN',
            } satisfies HealthResult,
          ] as const;
        } catch (error) {
          return [
            target.key,
            {
              durationMs: Math.round(performance.now() - start),
              message: error instanceof Error ? error.message : '请求失败',
              status: 'DOWN',
            } satisfies HealthResult,
          ] as const;
        }
      }),
    );
    setResults(Object.fromEntries(nextEntries));
    setLastCheckedAt(checkedAt.toLocaleString('zh-CN', { hour12: false }));
    setChecking(false);
  };

  return (
    <section className="health-page">
      <header className="app-catalog-hero">
        <div>
          <h1>服务健康检查</h1>
          <p>通过统一 Gateway 入口实时检查后端服务，展示最近一次检查时间、响应耗时和异常信息。</p>
        </div>
        <div className="app-catalog-page-actions">
          <span className="console-soft-badge">{lastCheckedAt ? `最近检查：${lastCheckedAt}` : '尚未检查'}</span>
          <button className="console-button console-button-primary app-catalog-new-button" type="button" disabled={checking} onClick={() => void checkHealth()}>
            <RefreshCw size={14} strokeWidth={1.9} aria-hidden="true" />
            {checking ? '检查中' : '重新检查'}
          </button>
        </div>
      </header>

      <div className="app-catalog-summary" aria-label="服务健康统计">
        <span>服务 {targets.length}</span>
        <span>UP {summary.up}</span>
        <span>异常 {summary.down}</span>
        <span>待检测 {summary.unknown}</span>
      </div>

      <div className="health-rich-list" role="list" aria-label="健康检查端点">
        {targets.map((target) => {
          const result = results[target.key] ?? UNKNOWN_RESULT;
          const Icon = getStatusIcon(result.status);

          return (
            <article className={`health-rich-row is-${result.status.toLowerCase()}`} key={target.key} role="listitem">
              <div className="model-rich-identity">
                <div className="app-project-title-row">
                  <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
                  <strong>{target.name}</strong>
                </div>
                <span>{target.key}</span>
              </div>
              <div className="model-rich-meta provider-url-meta">
                <span className="app-project-meta-label">健康检查地址</span>
                <strong>{target.url}</strong>
                <span>{result.message ?? '等待人工触发检查'}</span>
              </div>
              <div className="model-rich-meta">
                <span className="app-project-meta-label">响应耗时</span>
                <strong>{result.durationMs === undefined ? '-' : `${result.durationMs} ms`}</strong>
                <span>{lastCheckedAt || '尚无检查记录'}</span>
              </div>
              <div className="model-rich-status">
                <span className={`console-status-pill console-status-${getStatusLabel(result.status)}`}>{getStatusLabel(result.status)}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
