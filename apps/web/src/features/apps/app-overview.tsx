'use client';

/**
 * 应用详情 - 概览页组件
 * @author Antigravity/Claude-Sonnet-4.6
 * @author codex
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleGauge,
  Clock,
  Layers,
  Link2,
  Play,
  Settings2,
  UserRound,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { getErrorMessage } from '@/lib/error';
import { loadApp } from './api/app-api';
import { formatDuration, listPlans, listRuns } from './api/plan-execution-api';
import { AppIcon } from './app-icon';
import { assertAppViewData, type AppWithViewData } from './app-view-contract';
import type { PlanRecord, RunRecord } from './api/plan-execution-api';

const APP_BASE_PATH = '/ai-quality-platform/apps';

function passRateText(rate?: number) {
  return rate === undefined ? '-' : `${rate}%`;
}

function passRateColor(rate?: number) {
  if (rate === undefined) return 'text-muted-foreground';
  if (rate >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (rate >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function formatDateTime(value?: string) {
  if (!value) return '暂无记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无记录';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function getRunPassRate(run: RunRecord) {
  if (run.totalCount <= 0) return 0;
  return Math.round((run.passCount / run.totalCount) * 100);
}

function formatProtocolEndpoint(app: AppWithViewData) {
  return `${app.protocol.method} ${app.protocol.url.trim() ? app.protocol.url : '未配置接口'}`;
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  iconClassName,
  valueClassName,
}: {
  label: string;
  value: string | number;
  helper?: string;
  icon: LucideIcon;
  iconClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={cn('mt-2 text-3xl font-semibold tracking-normal text-foreground', valueClassName)}>{value}</p>
        </div>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground', iconClassName)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {helper ? <p className="mt-3 truncate text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/35 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function RecentRunRow({
  appCode,
  run,
  planName,
}: {
  appCode: string;
  run: RunRecord;
  planName: string;
}) {
  const passRate = getRunPassRate(run);
  const sequenceText = run.sequenceNo ? `第 ${run.sequenceNo} 次执行` : '执行记录';
  const durationText = typeof run.durationMs === 'number' ? formatDuration(run.durationMs) : '耗时未知';
  const href = `${APP_BASE_PATH}/${encodeURIComponent(appCode)}/plans/runs/${encodeURIComponent(run.runCode)}`;

  return (
    <Link
      href={href}
      className="group grid gap-4 border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_270px]"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{planName}</p>
          <Badge variant="outline" className="rounded-md">
            {sequenceText}
          </Badge>
          <Badge variant={run.status === 'COMPLETED' ? 'secondary' : 'outline'} className="rounded-md">
            {run.status === 'COMPLETED' ? '已完成' : run.status}
          </Badge>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
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

export function AppOverviewPage({ appCode }: { appCode: string }) {
  const [app, setApp] = useState<AppWithViewData | null>(null);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMessage(null);
    Promise.all([
      loadApp(appCode),
      listPlans(appCode),
      listRuns(appCode),
    ])
      .then(([appData, plansData, runsData]) => {
        if (!active) return;
        setApp(appData ? assertAppViewData(appData, '应用概览') : null);
        setPlans(plansData);
        setRuns(runsData);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setApp(null);
        setPlans([]);
        setRuns([]);
        setErrorMessage(getErrorMessage(error, '应用概览加载失败'));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [appCode]);

  const planNameByCode = useMemo(
    () => new Map(plans.map((plan) => [plan.planCode, plan.planName])),
    [plans],
  );

  if (loading) return <div className="text-muted-foreground">加载中...</div>;
  if (errorMessage) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
        <p className="font-medium text-destructive">应用概览加载失败</p>
        <p className="mt-1 text-sm text-destructive/80">{errorMessage}</p>
      </div>
    );
  }
  if (!app) return <div className="text-muted-foreground">应用不存在</div>;

  const stats = app.stats;
  const completedRuns = runs.filter((run) => run.status === 'COMPLETED');
  const recentRuns = completedRuns.slice(0, 5);
  const encodedAppCode = encodeURIComponent(app.appCode);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <AppIcon app={app} className="h-14 w-14 rounded-lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-normal text-foreground">{app.appName}</h1>
              <Badge variant={app.status === 'ENABLED' ? 'default' : 'secondary'} className="rounded-md">
                {app.status === 'ENABLED' ? '运行中' : '已停用'}
              </Badge>
              <Badge variant="outline" className="rounded-md">
                {app.appType}
              </Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{app.description || '暂无描述'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5" />
                {app.owner || '未设置负责人'}
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                <span className="max-w-[720px] truncate font-mono">
                  {formatProtocolEndpoint(app)}
                </span>
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`${APP_BASE_PATH}/${encodedAppCode}/cases`}>
              <Layers className="h-4 w-4" />
              用例管理
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`${APP_BASE_PATH}/${encodedAppCode}/plans`}>
              <Play className="h-4 w-4" />
              执行计划
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="测试用例"
          value={stats.caseCount}
          helper="已纳入当前应用的可执行用例"
          icon={Layers}
          iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          label="执行计划"
          value={stats.planCount}
          helper={`${plans.filter((plan) => plan.status === 'ENABLED').length} 个计划可执行`}
          icon={Play}
          iconClassName="bg-violet-500/10 text-violet-600 dark:text-violet-400"
        />
        <StatCard
          label="最近通过率"
          value={passRateText(stats.lastPassRate)}
          helper={stats.lastRunAt ? `最近执行 ${formatDateTime(stats.lastRunAt)}` : '尚未执行'}
          icon={CircleGauge}
          iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          valueClassName={passRateColor(stats.lastPassRate)}
        />
        <StatCard
          label="历史执行"
          value={runs.length}
          helper={`${completedRuns.length} 次已完成`}
          icon={Activity}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">最近执行记录</h2>
              <p className="mt-1 text-sm text-muted-foreground">展示最近完成的执行批次，点击可进入执行详情。</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`${APP_BASE_PATH}/${encodedAppCode}/history`}>
                查看全部
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          {recentRuns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              暂无执行记录
            </div>
          ) : (
            <div>
              {recentRuns.map((run) => (
                <RecentRunRow
                  key={run.runCode}
                  appCode={app.appCode}
                  run={run}
                  planName={planNameByCode.get(run.planCode) ?? run.planName ?? '未命名计划'}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">应用配置</h2>
          </div>
          <div className="grid gap-3">
            <DetailItem label="请求方法" value={app.protocol.method} />
            <DetailItem label="执行并发" value={app.protocol.appConcurrency} />
            <DetailItem label="答案路径" value={app.protocol.answerPath} />
            <DetailItem label="成功条件" value={app.protocol.successExpr} />
            <DetailItem label="流式响应" value={app.protocol.streamEnabled ? '已开启' : '未开启'} />
          </div>
        </aside>
      </div>
    </div>
  );
}
