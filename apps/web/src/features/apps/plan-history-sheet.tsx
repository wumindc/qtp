'use client';
/**
 * 计划执行历史侧边栏（Sheet）
 * 展示某个计划的完整执行记录，可点击跳转详情
 * @author Antigravity/Claude-Sonnet-4.6
 * @author codex
 */
import { CheckCircle2, XCircle, Loader2, Clock, BarChart2, History, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { type RunRecord, parseRunStartTime, formatDuration } from './api/plan-execution-api';

interface PlanHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  runs: RunRecord[];
  onSelectRun: (runCode: string) => void;
}

const statusConfig: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
}> = {
  COMPLETED: {
    label: '已完成',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10 border-emerald-500/20',
    icon: CheckCircle2,
  },
  RUNNING: {
    label: '执行中',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
    icon: Loader2,
  },
  FAILED: {
    label: '失败',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10 border-red-500/20',
    icon: XCircle,
  },
  CANCELLED: {
    label: '已取消',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50 border-border',
    icon: AlertCircle,
  },
};

export function PlanHistorySheet({
  open,
  onOpenChange,
  planName,
  runs,
  onSelectRun,
}: PlanHistorySheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[520px] max-w-[90vw] flex flex-col p-0">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <History className="h-4 w-4 text-primary" />
            </div>
            <SheetTitle>{planName}</SheetTitle>
          </div>
          <SheetDescription>
            共 {runs.length} 次执行记录，点击任意记录查看详情
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <History className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm">暂无执行记录</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {runs.map((run, index) => {
                const s = statusConfig[run.status] ?? statusConfig.COMPLETED;
                const StatusIcon = s.icon;
                const passRate =
                  run.totalCount > 0
                    ? Math.round((run.passCount / run.totalCount) * 100)
                    : 0;
                const startTime = run.startAt
                  ? new Date(run.startAt)
                  : parseRunStartTime(run.runCode);
                const isRunning = run.status === 'RUNNING';

                return (
                  <button
                    key={run.runCode}
                    type="button"
                    className="w-full text-left px-6 py-4 hover:bg-muted/40 transition-colors group"
                    onClick={() => {
                      onOpenChange(false);
                      onSelectRun(run.runCode);
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* 序号 + 状态 badge */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-mono text-muted-foreground/60">
                            #{run.sequenceNo ?? runs.length - index}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn('text-xs gap-1 border', s.bgColor, s.color)}
                          >
                            <StatusIcon
                              className={cn(
                                'h-3 w-3',
                                isRunning && 'animate-spin',
                              )}
                            />
                            {s.label}
                          </Badge>
                        </div>

                        {/* 执行时间 */}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          {startTime
                            ? startTime.toLocaleString('zh-CN')
                            : run.runCode}
                        </div>

                        {/* 统计行 */}
                        {run.status !== 'RUNNING' && run.totalCount > 0 && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span className="flex items-center gap-1 text-emerald-500">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {run.passCount} 通过
                            </span>
                            <span className="flex items-center gap-1 text-red-500">
                              <AlertCircle className="h-3.5 w-3.5" />
                              {run.failCount} 未达标
                            </span>
                            {run.reviewCount > 0 && (
                              <span className="text-amber-500">
                                {run.reviewCount} 待审
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <BarChart2 className="h-3.5 w-3.5" />
                              均分 {run.avgScore}
                            </span>
                          </div>
                        )}

                        {isRunning && (
                          <div className="flex items-center gap-1.5 text-xs text-blue-500">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            执行中，自动轮询刷新...
                          </div>
                        )}
                      </div>

                      {/* 通过率 */}
                      {!isRunning && run.totalCount > 0 && (
                        <div className="shrink-0 text-right">
                          <p
                            className={cn(
                              'text-2xl font-bold tabular-nums',
                              passRate >= 90
                                ? 'text-emerald-500'
                                : passRate >= 70
                                  ? 'text-amber-500'
                                  : 'text-red-500',
                            )}
                          >
                            {passRate}%
                          </p>
                          <p className="text-xs text-muted-foreground">通过率</p>
                          {run.durationMs !== undefined && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDuration(run.durationMs)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
