'use client';
/**
 * 服务健康检查页面
 * @author Antigravity/Gemini
 * @author codex
 */
import { Activity, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useHealthCheck, type HealthResult, type HealthStatus } from './hooks';

/* ── 工具函数 ── */
function statusLabel(s: HealthStatus) {
  if (s === 'UP') return 'UP';
  if (s === 'DOWN') return '异常';
  if (s === 'CHECKING') return '检查中';
  return '待检测';
}

function statusColor(s: HealthStatus) {
  if (s === 'UP') return 'text-emerald-500';
  if (s === 'DOWN') return 'text-destructive';
  return 'text-muted-foreground';
}

function StatusIcon({ status }: { status: HealthStatus }) {
  if (status === 'UP') return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  if (status === 'DOWN') return <XCircle className="h-5 w-5 text-destructive" />;
  return <Activity className={cn('h-5 w-5', status === 'CHECKING' && 'animate-pulse text-primary')} />;
}

function dependencyLine(result: HealthResult) {
  const database = result.dependencies?.database?.status;
  return database ? `数据库：${database}` : '依赖：-';
}

function workerLine(result: HealthResult) {
  const runningRunCount = result.worker?.runningRunCount;
  const activeRunCount = result.worker?.activeRunCount;
  if (runningRunCount === undefined && activeRunCount === undefined) return 'Worker：-';
  return `Worker：运行 ${runningRunCount ?? 0}，活跃 ${activeRunCount ?? 0}`;
}

/* ── 单行卡片 ── */
function HealthRow({ name, serviceKey, result }: { name: string; serviceKey: string; result: HealthResult }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card px-5 py-4 transition-colors hover:bg-accent/20">
      {/* 图标 + 名称 */}
      <StatusIcon status={result.status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {serviceKey === 'gateway' ? '公开入口聚合检查' : serviceKey === 'platform' ? '平台业务模块检查' : '执行与 Worker 检查'}
        </p>
      </div>

      {/* 消息 */}
      <div className="hidden md:block min-w-0 max-w-[280px] text-right shrink-0">
        <p className="text-xs text-muted-foreground truncate">{result.message ?? '等待触发检查'}</p>
        {serviceKey !== 'gateway' ? (
          <p className="text-xs text-muted-foreground truncate">{dependencyLine(result)}</p>
        ) : null}
        {serviceKey === 'execution' ? (
          <p className="text-xs text-muted-foreground truncate">{workerLine(result)}</p>
        ) : null}
      </div>

      {/* 耗时 */}
      <div className="w-20 text-right shrink-0">
        <span className="text-xs font-mono text-muted-foreground">
          {result.durationMs !== undefined ? `${result.durationMs} ms` : '—'}
        </span>
      </div>

      {/* 状态 badge */}
      <Badge
        variant={result.status === 'UP' ? 'default' : result.status === 'DOWN' ? 'destructive' : 'secondary'}
        className={cn('shrink-0 w-16 justify-center', result.status === 'UP' && 'bg-emerald-500 hover:bg-emerald-500/90')}
      >
        {statusLabel(result.status)}
      </Badge>
    </div>
  );
}

/* ── 统计卡片 ── */
function SummaryCard({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-card px-5 py-4 text-center', className)}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

/* ══ 主页面 ══ */
export function HealthPage() {
  const { targets, routeMappings, results, summary, lastCheckedAt, checking, checkAll } = useHealthCheck();
  const platformSegments = routeMappings
    .filter((route) => route.targetService === 'platform')
    .map((route) => route.segment)
    .join(' / ');
  const executionSegments = routeMappings
    .filter((route) => route.targetService === 'execution')
    .map((route) => route.segment)
    .join(' / ');

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">服务健康检查</h1>
          <p className="text-sm text-muted-foreground mt-1">
            通过统一 Gateway 入口实时检查后端服务，展示响应耗时和异常信息。
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {lastCheckedAt ? (
            <span className="text-xs text-muted-foreground">最近检查：{lastCheckedAt}</span>
          ) : (
            <span className="text-xs text-muted-foreground">尚未检查</span>
          )}
          <Button
            onClick={() => void checkAll()}
            disabled={checking}
            size="sm"
          >
            <RefreshCw className={cn('h-4 w-4', checking && 'animate-spin')} />
            {checking ? '检查中…' : '重新检查'}
          </Button>
        </div>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="全部服务" value={targets.length} />
        <SummaryCard label="UP" value={summary.up} className="border-emerald-500/30" />
        <SummaryCard label="异常" value={summary.down} className="border-destructive/30" />
        <SummaryCard label="待检测" value={summary.unknown} />
      </div>

      <div className="rounded-lg border bg-card px-5 py-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">公开 API 路由</p>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">quality-platform-service</p>
            <p className="text-sm font-medium truncate">{platformSegments}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">quality-execution-service</p>
            <p className="text-sm font-medium truncate">{executionSegments}</p>
          </div>
        </div>
      </div>

      {/* 服务列表 */}
      <div className="space-y-2">
        {targets.map((t) => (
          <HealthRow
            key={t.key}
            name={t.name}
            serviceKey={t.key}
            result={results[t.key] ?? { status: 'UNKNOWN' }}
          />
        ))}
      </div>
    </div>
  );
}
