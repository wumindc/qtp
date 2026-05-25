/**
 * 应用详情 - 概览页组件
 * @author Antigravity/Gemini-2.5-Pro
 */
'use client';

import { useState, useEffect } from 'react';
import { Bot, TrendingUp, Layers, Play, Clock, CheckCircle2, XCircle, Activity } from 'lucide-react';
import { cn } from '@/lib/cn';
import { loadApp } from './api/app-api';
import type { App, ExecutionRun } from './types';

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', color ?? 'bg-muted')}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

export function AppOverviewPage({ appCode }: { appCode: string }) {
  const [app, setApp] = useState<App | null>(null);
  const [runs, setRuns] = useState<ExecutionRun[]>([]);

  useEffect(() => {
    void loadApp(appCode).then(setApp);
  }, [appCode]);

  if (!app) return <div className="text-muted-foreground">加载中...</div>;

  const completedRuns = runs.filter((r) => r.status === 'COMPLETED');
  const lastRun = completedRuns[0];

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center">
          <Bot className="h-6 w-6 text-violet-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">{app.appName}</h1>
          <p className="text-sm text-muted-foreground">{app.description || '暂无描述'}</p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="测试用例" value={app.stats?.caseCount ?? 0} icon={Layers} color="bg-blue-500/10 text-blue-500" />
        <StatCard label="执行计划" value={app.stats?.planCount ?? 0} icon={Play} color="bg-violet-500/10 text-violet-500" />
        <StatCard
          label="最近通过率"
          value={app.stats?.lastPassRate !== undefined ? `${app.stats.lastPassRate}%` : '-'}
          icon={TrendingUp}
          color={
            (app.stats?.lastPassRate ?? 0) >= 90
              ? 'bg-emerald-500/10 text-emerald-500'
              : (app.stats?.lastPassRate ?? 0) >= 70
                ? 'bg-amber-500/10 text-amber-500'
                : 'bg-red-500/10 text-red-500'
          }
        />
        <StatCard label="历史执行" value={runs.length} icon={Activity} color="bg-muted text-muted-foreground" />
      </div>

      {/* 最近执行 */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">最近执行记录</h2>
        {completedRuns.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">暂无执行记录</div>
        ) : (
          <div className="space-y-3">
            {completedRuns.slice(0, 5).map((run) => (
              <div key={run.runCode} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{run.planName}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    {new Date(run.startAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{run.stats.passRate}%</p>
                    <p className="text-xs text-muted-foreground">{run.stats.pass}/{run.stats.total} 通过</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-emerald-500">{run.stats.pass}</span>
                    <XCircle className="h-4 w-4 text-red-500 ml-1" />
                    <span className="text-sm text-red-500">{run.stats.fail}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
