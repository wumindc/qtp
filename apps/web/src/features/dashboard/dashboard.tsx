'use client';

/**
 * 平台首页工作台
 * @author codex
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  CircleGauge,
  ClipboardList,
  Clock,
  HeartPulse,
  Layers3,
  Play,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { getErrorMessage } from '@/lib/error';
import { postGateway } from '@/lib/api/gateway-client';
import { loadApps } from '../apps/api/app-api';
import { formatDuration, listPlans, listRuns } from '../apps/api/plan-execution-api';
import { AppIcon } from '../apps/app-icon';
import type { PlanRecord, RunRecord } from '../apps/api/plan-execution-api';
import type { App } from '../apps/types';

interface DashboardMetrics {
  appCount: number;
  caseCount: number;
  planCount: number;
  avgPassRate: number;
  pendingReviewCount: number;
  failedRunCount: number;
}

interface DashboardRun extends RunRecord {
  appName: string;
  planName: string;
}

const APP_BASE_PATH = '/ai-quality-platform/apps';

type FocusApp = App & {
  stats: NonNullable<App['stats']> & {
    lastPassRate: number;
  };
};

function readDashboardRecord(raw: unknown) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  throw new Error('工作台统计响应格式不正确');
}

function readDashboardNumber(value: unknown, message: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(message);
  }
  return value;
}

function normalizeMetrics(raw: unknown): DashboardMetrics {
  const data = readDashboardRecord(raw);
  return {
    appCount: readDashboardNumber(data.appCount, '工作台统计缺少应用数量'),
    caseCount: readDashboardNumber(data.caseCount, '工作台统计缺少用例数量'),
    planCount: readDashboardNumber(data.planCount, '工作台统计缺少计划数量'),
    avgPassRate: readDashboardNumber(data.avgPassRate, '工作台统计缺少平均通过率'),
    pendingReviewCount: readDashboardNumber(data.pendingReviewCount, '工作台统计缺少待复核数量'),
    failedRunCount: readDashboardNumber(data.failedRunCount, '工作台统计缺少未达标批次数量'),
  };
}

/**
 * @author codex
 * @author Antigravity/Claude-Sonnet-4.6
 * 工作台统计使用 postGateway 自动携带 Authorization token。
 * 后端 dashboard.do 已改为 POST 与全项目其他接口保持一致。
 */
async function loadDashboardMetrics(): Promise<DashboardMetrics> {
  const payload = await postGateway<unknown>('statistics', '/report/dashboard.do', {}, { cache: 'no-store' });
  return normalizeMetrics(payload);
}

function formatDateTime(value?: string) {
  if (!value) return '暂无时间';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无时间';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function passRateColor(rate?: number) {
  if (rate === undefined) return 'text-muted-foreground';
  if (rate >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (rate >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function hasFocusStats(app: App): app is FocusApp {
  return typeof app.stats?.lastPassRate === 'number' && Number.isFinite(app.stats.lastPassRate);
}

function getRunPassRate(run: RunRecord) {
  if (run.totalCount <= 0) return 0;
  return Math.round((run.passCount / run.totalCount) * 100);
}

function runTimestamp(run: RunRecord) {
  const date = new Date(run.startAt ?? run.endAt ?? '');
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'muted',
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: LucideIcon;
  tone?: 'blue' | 'violet' | 'emerald' | 'amber' | 'red' | 'muted';
}) {
  const tones = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400',
    muted: 'bg-muted text-muted-foreground',
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-normal text-foreground">{value}</p>
        </div>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tones[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 truncate text-xs text-muted-foreground">{helper}</p>
    </section>
  );
}

function RecentRunItem({ run }: { run: DashboardRun }) {
  const passRate = getRunPassRate(run);
  const sequenceText = run.sequenceNo ? `第 ${run.sequenceNo} 次执行` : '执行记录';
  const durationText = typeof run.durationMs === 'number' ? formatDuration(run.durationMs) : '耗时未知';
  const href = `${APP_BASE_PATH}/${encodeURIComponent(run.appCode)}/plans/runs/${encodeURIComponent(run.runCode)}`;

  return (
    <Link
      href={href}
      className="group grid gap-4 border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_260px]"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{run.planName}</p>
          <Badge variant="outline" className="rounded-md">
            {sequenceText}
          </Badge>
          <Badge variant="secondary" className="rounded-md">
            {run.status === 'COMPLETED' ? '已完成' : run.status}
          </Badge>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Bot className="h-3.5 w-3.5" />
            {run.appName}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" />
            {formatDateTime(run.startAt)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {durationText}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-5 md:justify-end">
        <div className="min-w-[108px] text-left md:text-right">
          <p className={cn('text-lg font-semibold', passRateColor(passRate))}>{passRate}%</p>
          <p className="text-xs text-muted-foreground">{`${run.passCount} / ${run.totalCount} 通过`}</p>
        </div>
        <div className="flex min-w-[132px] items-center justify-end gap-3 text-sm">
          <span className="inline-flex items-center gap-1 whitespace-nowrap text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            {run.passCount}
          </span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap text-red-600 dark:text-red-400">
            <XCircle className="h-4 w-4" />
            {`${run.failCount} 未达标`}
          </span>
        </div>
        <ArrowRight className="hidden h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary md:block" />
      </div>
    </Link>
  );
}

function FocusAppItem({ app }: { app: FocusApp }) {
  const { stats } = app;
  const passRate = stats.lastPassRate;
  return (
    <Link
      href={`${APP_BASE_PATH}/${encodeURIComponent(app.appCode)}/overview`}
      className="group flex items-center gap-3 border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0"
    >
      <AppIcon app={app} className="h-10 w-10 rounded-lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{app.appName}</p>
          <Badge variant="outline" className="rounded-md">
            {app.owner || '未设置'}
          </Badge>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {stats.caseCount} 用例 · {stats.planCount} 计划 · 最近 {formatDateTime(stats.lastRunAt)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn('text-lg font-semibold', passRateColor(passRate))}>{passRate === undefined ? '-' : `${passRate}%`}</p>
        <p className="text-xs text-muted-foreground">通过率</p>
      </div>
    </Link>
  );
}

function EntryLink({
  href,
  icon: Icon,
  label,
  value,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/45">
      <span className="inline-flex items-center gap-3 text-sm font-medium text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
      </span>
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        {value}
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

export function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [apps, setApps] = useState<App[]>([]);
  const [recentRuns, setRecentRuns] = useState<DashboardRun[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    async function refresh() {
      setStatus('loading');
      setLoadError(null);
      try {
        const [nextMetrics, nextApps] = await Promise.all([
          loadDashboardMetrics(),
          loadApps(),
        ]);
        const appContexts = await Promise.all(
          nextApps.slice(0, 20).map(async (app) => {
            const [plans, runs] = await Promise.all([
              listPlans(app.appCode),
              listRuns(app.appCode),
            ]);
            return { app, plans, runs };
          }),
        );
        const nextRuns = appContexts
          .flatMap(({ app, plans, runs }) => {
            const planNameByCode = new Map(plans.map((plan) => [plan.planCode, plan.planName]));
            return runs.map((run) => ({
              ...run,
              appName: app.appName,
              planName: planNameByCode.get(run.planCode) ?? run.planName ?? '未命名计划',
            }));
          })
          .sort((a, b) => runTimestamp(b) - runTimestamp(a))
          .slice(0, 5);

        if (disposed) return;
        setMetrics(nextMetrics);
        setApps(nextApps);
        setRecentRuns(nextRuns);
        setStatus('ready');
      } catch (error: unknown) {
        if (disposed) return;
        setMetrics(null);
        setApps([]);
        setRecentRuns([]);
        setLoadError(getErrorMessage(error, '工作台数据加载失败'));
        setStatus('error');
      }
    }

    void refresh();

    return () => {
      disposed = true;
    };
  }, []);

  const focusApps = useMemo(
    () =>
      apps
        .filter(hasFocusStats)
        .sort((left, right) => left.stats.lastPassRate - right.stats.lastPassRate)
        .slice(0, 4),
    [apps],
  );
  const statusText = status === 'loading' ? '加载中' : status === 'ready' ? '服务端数据' : '统计异常';
  const latestRun = recentRuns[0];

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal text-foreground">工作台</h1>
            <Badge variant={status === 'error' ? 'destructive' : status === 'ready' ? 'default' : 'secondary'} className="rounded-md">
              {statusText}
            </Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">平台质量总览、最近执行和重点应用。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/ai-quality-platform/health">
              <HeartPulse className="h-4 w-4" />
              服务健康
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/ai-quality-platform/apps">
              <Bot className="h-4 w-4" />
              AI 应用
            </Link>
          </Button>
        </div>
      </header>

      {status === 'loading' ? (
        <section className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
          工作台加载中...
        </section>
      ) : null}

      {loadError ? (
        <section role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm font-semibold text-destructive">工作台加载失败</p>
          <p className="mt-1 text-xs text-destructive/80">{loadError}</p>
        </section>
      ) : null}

      {metrics ? (
        <>
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">今日质量概览</p>
            <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <p className={cn('text-4xl font-semibold tracking-normal', passRateColor(metrics.avgPassRate))}>{metrics.avgPassRate}%</p>
                <p className="mt-1 text-sm text-muted-foreground">平均通过率</p>
              </div>
              <div className="text-sm text-muted-foreground">
                {latestRun ? (
                  <span>
                    最近执行：{latestRun.appName} · {latestRun.planName} · {latestRun.sequenceNo ? `第 ${latestRun.sequenceNo} 次` : '执行记录'}
                  </span>
                ) : (
                  <span>暂无执行记录</span>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-muted/35 p-3">
              <p className="text-muted-foreground">待复核</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{metrics.pendingReviewCount}</p>
            </div>
            <div className="rounded-lg bg-muted/35 p-3">
              <p className="text-muted-foreground">未达标批次</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{metrics.failedRunCount}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="AI 应用" value={metrics.appCount} helper={`${apps.length} 个已加载`} icon={Bot} tone="blue" />
        <MetricCard label="测试用例" value={metrics.caseCount} helper="平台用例总量" icon={ClipboardList} tone="violet" />
        <MetricCard label="执行计划" value={metrics.planCount} helper="已创建计划" icon={Layers3} tone="emerald" />
        <MetricCard label="平均通过率" value={`${metrics.avgPassRate}%`} helper="按完成批次计算" icon={CircleGauge} tone="amber" />
        <MetricCard label="待复核" value={metrics.pendingReviewCount} helper="人工确认结果" icon={AlertTriangle} tone={metrics.pendingReviewCount > 0 ? 'amber' : 'muted'} />
        <MetricCard label="未达标批次" value={metrics.failedRunCount} helper="存在未达标结果" icon={XCircle} tone={metrics.failedRunCount > 0 ? 'red' : 'muted'} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">最近执行</h2>
              <p className="mt-1 text-sm text-muted-foreground">最新批次与达标情况。</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/ai-quality-platform/apps">
                查看应用
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          {recentRuns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">暂无执行记录</div>
          ) : (
            <div>{recentRuns.map((run) => <RecentRunItem key={run.runCode} run={run} />)}</div>
          )}
        </div>

        <aside className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">重点关注应用</h2>
              <p className="mt-1 text-sm text-muted-foreground">按最近通过率排序。</p>
            </div>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          {focusApps.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">暂无可关注应用</div>
          ) : (
            <div>{focusApps.map((app) => <FocusAppItem key={app.appCode} app={app} />)}</div>
          )}
        </aside>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <EntryLink href="/ai-quality-platform/apps" icon={Bot} label="AI 应用" value={metrics.appCount} />
        <EntryLink href="/ai-quality-platform/cases" icon={ClipboardList} label="预置用例" value={metrics.caseCount} />
        <EntryLink href="/ai-quality-platform/providers" icon={CircleGauge} label="模型中心" value={statusText} />
        <EntryLink href="/ai-quality-platform/health" icon={HeartPulse} label="服务健康" value="查看" />
      </section>
        </>
      ) : null}
    </main>
  );
}
