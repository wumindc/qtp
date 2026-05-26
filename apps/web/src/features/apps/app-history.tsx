'use client';
/**
 * 应用执行历史页（接入真实后端数据）
 * @author Antigravity/Claude-Sonnet-4.6
 * @author codex
 */
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, CheckCircle2, XCircle, Loader2, Clock, BarChart2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';
import { listRuns, parseRunStartTime, type RunRecord } from './api/plan-execution-api';

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  COMPLETED: { label: '已完成', color: 'text-emerald-500', icon: CheckCircle2 },
  RUNNING: { label: '运行中', color: 'text-blue-500', icon: Loader2 },
  FAILED: { label: '失败', color: 'text-red-500', icon: XCircle },
  CANCELLED: { label: '已取消', color: 'text-muted-foreground', icon: XCircle },
};

function formatRunStartedAt(run: RunRecord): string {
  if (run.startAt) return new Date(run.startAt).toLocaleString('zh-CN');
  const legacyStartedAt = parseRunStartTime(run.runCode);
  return legacyStartedAt ? legacyStartedAt.toLocaleString('zh-CN') : '未知时间';
}

export function AppHistoryPage({ appCode }: { appCode: string }) {
  const router = useRouter();
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRuns = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listRuns(appCode);
      setRuns(data);
    } catch {
      toast.error('加载执行历史失败');
    } finally {
      setLoading(false);
    }
  }, [appCode]);

  useEffect(() => { void loadRuns(); }, [loadRuns]);

  const openRunDetail = (runCode: string) => {
    router.push(
      `/ai-quality-platform/apps/${encodeURIComponent(appCode)}/history/${encodeURIComponent(runCode)}`,
    );
  };

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex items-center gap-3 shrink-0">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Activity className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">执行历史</h1>
          <p className="text-sm text-muted-foreground">共 {runs.length} 次执行记录</p>
        </div>
      </div>

      <div className="space-y-3">
        {loading && (
          <div className="text-center py-12 text-muted-foreground text-sm">加载中...</div>
        )}
        {!loading && runs.map((run) => {
          const s = statusConfig[run.status] ?? statusConfig.COMPLETED;
          const StatusIcon = s.icon;
          const passRate = run.totalCount > 0
            ? Math.round((run.passCount / run.totalCount) * 100)
            : 0;
          const reviewRate = run.totalCount > 0
            ? Math.round((run.reviewCount / run.totalCount) * 100)
            : 0;

          return (
            <div
              key={run.runCode}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => openRunDetail(run.runCode)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <StatusIcon className={cn('h-4 w-4 shrink-0', s.color, run.status === 'RUNNING' && 'animate-spin')} />
                    <span className="text-sm font-semibold text-foreground">{run.planCode}</span>
                    <Badge variant="outline" className={cn('text-xs', s.color)}>
                      {s.label}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatRunStartedAt(run)}
                    </span>
                    <span className="flex items-center gap-1">
                      <BarChart2 className="h-3.5 w-3.5" />
                      平均分 {run.avgScore}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xl font-bold text-foreground">{passRate}%</p>
                      <p className="text-xs text-muted-foreground">通过率</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-emerald-500 font-medium">{run.passCount}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                        <span className="text-red-500 font-medium">{run.failCount}</span>
                      </div>
                      {run.reviewCount > 0 && (
                        <div className="flex items-center gap-1 text-sm">
                          <span className="text-amber-500 font-medium">待审 {run.reviewCount}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    总计 {run.totalCount} 条 · 待审 {reviewRate}%
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && runs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无执行记录</p>
          </div>
        )}
      </div>
    </div>
  );
}
