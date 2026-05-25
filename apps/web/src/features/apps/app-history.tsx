'use client';
/**
 * 应用执行历史页
 * @author Antigravity/Gemini-2.5-Pro
 */
import { useExecutionRuns } from './mock-hooks';
import { Activity, CheckCircle2, XCircle, Loader2, Clock, Cpu } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import Link from 'next/link';

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  COMPLETED: { label: '已完成', color: 'text-emerald-500', icon: CheckCircle2 },
  RUNNING: { label: '运行中', color: 'text-blue-500', icon: Loader2 },
  FAILED: { label: '失败', color: 'text-red-500', icon: XCircle },
  CANCELLED: { label: '已取消', color: 'text-muted-foreground', icon: XCircle },
};

export function AppHistoryPage({ appCode }: { appCode: string }) {
  const { runs } = useExecutionRuns(appCode);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Activity className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">执行历史</h1>
          <p className="text-sm text-muted-foreground">共 {runs.length} 次执行记录</p>
        </div>
      </div>

      <div className="space-y-3">
        {runs.map((run) => {
          const s = statusConfig[run.status] ?? statusConfig.FAILED;
          const StatusIcon = s.icon;

          return (
            <Link
              key={run.runCode}
              href={`/ai-quality-platform/apps/${encodeURIComponent(appCode)}/runs/${run.runCode}`}
              className="block"
            >
              <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusIcon className={cn('h-4 w-4 shrink-0', s.color, run.status === 'RUNNING' && 'animate-spin')} />
                      <span className="text-sm font-semibold text-foreground">{run.planName ?? run.planCode}</span>
                      <Badge variant="outline" className={cn('text-xs', s.color)}>
                        {s.label}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(run.startAt).toLocaleString('zh-CN')}
                      </span>
                      {run.evalModelName && (
                        <span className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          <Cpu className="h-3 w-3" />
                          {run.evalModelName}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-xl font-bold text-foreground">{run.stats.passRate}%</p>
                        <p className="text-xs text-muted-foreground">通过率</p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-emerald-500 font-medium">{run.stats.pass}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                          <span className="text-red-500 font-medium">{run.stats.fail}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">总计 {run.stats.total} 条</p>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}

        {runs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无执行记录</p>
          </div>
        )}
      </div>
    </div>
  );
}
