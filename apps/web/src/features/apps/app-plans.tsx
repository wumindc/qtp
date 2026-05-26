'use client';
/**
 * 应用执行计划页（升级版）
 * - 计划卡片三态：从未执行 / 执行中（进度轮询）/ 已完成（统计摘要）
 * - 卡片展开显示最近3次历史，支持「查看更多」侧边栏
 * - 内嵌执行详情（无需跳路由）
 * @author Antigravity/Claude-Sonnet-4.6
 * @author codex
 */
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock3,
  Layers3,
  Loader2,
  Plus,
  Play,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  MoreHorizontal,
  AlertCircle,
  BarChart3,
  Timer,
  Calendar,
  RefreshCw,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PopoverConfirm } from '@/components/ui/popover-confirm';
import {
  startPlan,
  createPlan,
  updatePlan,
  deletePlan,
  parseRunStartTime,
  formatDuration,
  type PlanRecord,
  type RunRecord,
} from './api/plan-execution-api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/cn';
import { usePlanRuns } from './use-plan-runs';
import { PlanHistorySheet } from './plan-history-sheet';

// ── 常量 ──

// ── 工具函数 ──

function getPassRateColor(rate: number) {
  if (rate >= 90) return 'text-emerald-500';
  if (rate >= 70) return 'text-amber-500';
  return 'text-red-500';
}

function formatRunTime(run: RunRecord): string {
  if (run.startAt) return new Date(run.startAt).toLocaleString('zh-CN');
  const t = parseRunStartTime(run.runCode);
  return t ? t.toLocaleString('zh-CN') : run.runCode;
}

function formatRunSequence(run: RunRecord, fallback?: number): string {
  const sequence = run.sequenceNo ?? fallback;
  return sequence ? `第 ${sequence} 次` : '执行记录';
}

function formatRunActionLabel(run: RunRecord): string {
  return `${run.sequenceNo ? `${formatRunSequence(run)}执行` : '最近一次'} · 点击查看详情`;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function buildCaseFilter(form: {
  scope: 'ALL' | 'CATEGORY';
  selectedCategories: Set<string>;
}): Record<string, unknown> {
  return {
    categoryCodes:
      form.scope === 'CATEGORY' ? Array.from(form.selectedCategories) : [],
    riskLevels: [],
    selectedCaseCodes: [],
  };
}

// ── 子组件：执行中状态区 ──

function RunningStatusArea({ run }: { run: RunRecord }) {
  const startTime = run.startAt ? new Date(run.startAt) : parseRunStartTime(run.runCode);
  const elapsed = startTime ? Date.now() - startTime.getTime() : null;

  // 已处理用例数（后端边跑边写，不代表最终结果）
  const doneCount = run.passCount + run.failCount + run.reviewCount;
  // 最多显示 99%，等状态切换到 COMPLETED 后再显示完成态
  const progress = run.totalCount > 0
    ? Math.min(Math.round((doneCount / run.totalCount) * 100), 99)
    : 0;
  // 所有用例已处理但状态还未切换时，提示「汇总中」
  const isSummarizing = run.totalCount > 0 && doneCount >= run.totalCount;

  return (
    <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
            {isSummarizing ? '结果汇总中...' : '执行中'}
          </span>
          {run.sequenceNo && (
            <span className="text-xs text-blue-500">{formatRunSequence(run)}</span>
          )}
          {startTime && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {startTime.toLocaleString('zh-CN')}
            </span>
          )}
        </div>
        {elapsed !== null && elapsed > 0 && (
          <span className="text-xs text-blue-500 flex items-center gap-1 shrink-0">
            <Timer className="h-3 w-3" />
            已耗时 {formatDuration(elapsed)}
          </span>
        )}
      </div>

      {run.totalCount > 0 && (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{isSummarizing ? '正在生成报告' : '执行进度'}</span>
            <span className="font-mono text-blue-500">
              {doneCount} / {run.totalCount}
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                isSummarizing
                  ? 'bg-gradient-to-r from-blue-400 to-blue-600 animate-pulse w-full'
                  : 'bg-blue-500',
              )}
              style={isSummarizing ? undefined : { width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {isSummarizing
              ? '所有用例已处理，等待后端切换最终状态...'
              : doneCount > 0
                ? `已处理 ${doneCount} 条，完成后显示最终结果`
                : '等待执行引擎分配任务...'}
          </p>
        </div>
      )}
    </div>
  );
}

// ── 子组件：最近一次完成结果（可点击进详情） ──


function LatestRunSummary({
  run,
  onSelect,
}: {
  run: RunRecord;
  onSelect: (runCode: string) => void;
}) {
  const passRate =
    run.totalCount > 0 ? Math.round((run.passCount / run.totalCount) * 100) : 0;
  const startTime = formatRunTime(run);

  return (
    <button
      type="button"
      onClick={() => onSelect(run.runCode)}
      className="mt-3 w-full text-left rounded-xl border border-border/60 bg-muted/20 px-4 py-3 hover:border-primary/30 hover:bg-primary/5 transition-all duration-150 group cursor-pointer"
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 text-foreground font-medium group-hover:text-primary transition-colors">
            <Clock3 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            {formatRunActionLabel(run)}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {startTime}
          </span>
          {run.durationMs !== undefined && (
            <span className="flex items-center gap-1">
              <Timer className="h-3 w-3" />
              {formatDuration(run.durationMs)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> {run.passCount}
            </span>
            <span className="text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> {run.failCount} 未达标
            </span>
            {run.reviewCount > 0 && (
              <span className="text-amber-500 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> {run.reviewCount}
              </span>
            )}
            <span className="text-muted-foreground flex items-center gap-1">
              <BarChart3 className="h-3.5 w-3.5" /> 均分 {run.avgScore}
            </span>
          </div>
          <div
            className={cn(
              'text-xl font-bold tabular-nums',
              getPassRateColor(passRate),
            )}
          >
            {passRate}%
          </div>
        </div>
      </div>
    </button>
  );
}

// ── 子组件：未执行状态区 ──

function NeverRunArea() {
  return (
    <div className="mt-3 rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-3">
      <p className="text-xs text-muted-foreground/60 text-center">
        从未执行 · 点击「立即执行」触发首次测试
      </p>
    </div>
  );
}

// ── 子组件：历史记录展开行 ──

function HistoryRow({
  run,
  index,
  onSelect,
}: {
  run: RunRecord;
  index: number;
  onSelect: (runCode: string) => void;
}) {
  const passRate =
    run.totalCount > 0 ? Math.round((run.passCount / run.totalCount) * 100) : 0;
  const isRunning = run.status === 'RUNNING';

  return (
    <button
      type="button"
      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors text-left group rounded-lg"
      onClick={() => onSelect(run.runCode)}
    >
      <span className="text-xs font-mono text-muted-foreground/50 w-4 shrink-0">
        #{run.sequenceNo ?? index + 1}
      </span>

      {isRunning ? (
        <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
      ) : passRate >= 90 ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
      ) : passRate >= 70 ? (
        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatRunTime(run)}
          </span>
          {run.durationMs !== undefined && (
            <span className="flex items-center gap-1">
              <Timer className="h-3 w-3" />
              {formatDuration(run.durationMs)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {!isRunning && run.totalCount > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-500">{run.passCount}✓</span>
            <span className="text-red-500">{run.failCount} 未达标</span>
          </div>
        )}
        {!isRunning && run.totalCount > 0 && (
          <span
            className={cn(
              'text-sm font-bold tabular-nums',
              getPassRateColor(passRate),
            )}
          >
            {passRate}%
          </span>
        )}
        {isRunning && (
          <Badge
            variant="outline"
            className="text-xs border-blue-500/30 bg-blue-500/10 text-blue-500"
          >
            执行中
          </Badge>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground transition-colors -rotate-90" />
      </div>
    </button>
  );
}

// ── 子组件：计划卡片 ──

interface PlanCardProps {
  plan: PlanRecord;
  runs: RunRecord[];
  totalRuns: number;
  isLocalExecuting: boolean;
  onRun: (plan: PlanRecord) => void;
  onEdit: (plan: PlanRecord) => void;
  onDelete: (planCode: string) => void;
  onSelectRun: (runCode: string) => void;
  onOpenHistory: (plan: PlanRecord) => void;
}

function PlanCard({
  plan,
  runs,
  totalRuns,
  isLocalExecuting,
  onRun,
  onEdit,
  onDelete,
  onSelectRun,
  onOpenHistory,
}: PlanCardProps) {
  const [expanded, setExpanded] = useState(false);

  const latestRun = runs[0] ?? null;
  const isRunning = isLocalExecuting || latestRun?.status === 'RUNNING';
  const runningRun = latestRun?.status === 'RUNNING' ? latestRun : null;
  const recentRuns = runs.slice(0, 3);
  const hasMore = totalRuns > 3;

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-xl transition-all duration-200',
        isRunning && 'border-blue-500/40 bg-blue-500/[0.03]',
        expanded && 'shadow-sm',
      )}
    >
      {/* ── 卡片主体 ── */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* 左侧信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-foreground">{plan.planName}</h3>
            </div>

            {/* 状态区
                优先级：执行中（本地触发 or 服务端 RUNNING）> 有历史 > 从未执行 */}
            {isRunning ? (
              // 只有服务端 RUNNING run 才展示真实进度，避免把上一条完成记录误当作执行进度
              runningRun ? (
                <RunningStatusArea run={runningRun} />
              ) : (
                <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">执行中</span>
                    <span className="text-xs text-muted-foreground">已提交，等待服务端响应...</span>
                  </div>
                </div>
              )
            ) : latestRun ? (
              <LatestRunSummary run={latestRun} onSelect={onSelectRun} />
            ) : (
              <NeverRunArea />
            )}
          </div>

          {/* 右侧操作 */}
          {!isRunning && (
            <div className="flex items-center gap-2 shrink-0">
              <PopoverConfirm
                trigger={
                  <Button
                    size="sm"
                    variant="default"
                    className="gap-1.5 h-8"
                  >
                    <Play className="h-3.5 w-3.5" />
                    立即执行
                  </Button>
                }
                title="立即执行"
                description={`确定立即触发「${plan.planName}」计划执行？`}
                onConfirm={() => onRun(plan)}
                confirmLabel="确认执行"
              />
              <Button
                aria-label="编辑计划"
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => onEdit(plan)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <PopoverConfirm
                trigger={
                  <Button
                    aria-label="删除计划"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                }
                title="删除计划"
                description={`确定要删除「${plan.planName}」吗？删除后历史记录仍可查看。`}
                onConfirm={() => onDelete(plan.planCode)}
              />
            </div>
          )}
        </div>

        {/* 展开/折叠按钮（有历史时显示） */}
        {totalRuns > 0 && (
          <button
            type="button"
            className="mt-3 w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/40"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                收起历史记录
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                查看最近执行记录（{Math.min(totalRuns, 3)} / {totalRuns} 次）
              </>
            )}
          </button>
        )}
      </div>

      {/* ── 展开的历史记录区 ── */}
      {expanded && totalRuns > 0 && (
        <div className="border-t border-border/60 px-2 py-2 bg-muted/20 rounded-b-xl">
          <div className="space-y-0.5">
            {recentRuns.map((run, i) => (
              <HistoryRow
                key={run.runCode}
                run={run}
                index={i}
                onSelect={onSelectRun}
              />
            ))}
          </div>

          {hasMore && (
            <div className="pt-2 pb-1 text-center">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-primary/5"
                onClick={() => onOpenHistory(plan)}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
                查看全部 {totalRuns} 次执行记录
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// 主页面组件
// ══════════════════════════════════════════

export function AppPlansPage({ appCode }: { appCode: string }) {
  const router = useRouter();
  const {
    plans,
    runsByPlan,
    totalRunsByPlan,
    categories,
    loading,
    refresh,
    reload,
    upsertRun,
  } = usePlanRuns(appCode);

  const [executingPlanCodes, setExecutingPlanCodes] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanRecord | null>(null);

  // 侧边栏历史
  const [historySheet, setHistorySheet] = useState<{
    open: boolean;
    plan: PlanRecord | null;
  }>({ open: false, plan: null });

  const [form, setForm] = useState<{
    planName: string;
    scope: 'ALL' | 'CATEGORY';
    selectedCategories: Set<string>;
  }>({
    planName: '',
    scope: 'ALL',
    selectedCategories: new Set(),
  });

  const resetForm = useCallback(() => {
    setForm({
      planName: '',
      scope: 'ALL',
      selectedCategories: new Set(),
    });
  }, []);

  const openCreateDialog = useCallback(() => {
    setEditingPlan(null);
    resetForm();
    setDialogOpen(true);
  }, [resetForm]);

  const openEditDialog = useCallback((plan: PlanRecord) => {
    const categoryCodes = readStringArray(plan.caseFilter.categoryCodes);
    setEditingPlan(plan);
    setForm({
      planName: plan.planName,
      scope: categoryCodes.length > 0 ? 'CATEGORY' : 'ALL',
      selectedCategories: new Set(categoryCodes),
    });
    setDialogOpen(true);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
      toast.success('已刷新');
    } catch {
      toast.error('刷新失败');
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const openRunDetail = useCallback(
    (runCode: string) => {
      router.push(
        `/ai-quality-platform/apps/${encodeURIComponent(appCode)}/plans/runs/${encodeURIComponent(runCode)}`,
      );
    },
    [appCode, router],
  );

  const handleRun = useCallback(
    async (plan: PlanRecord) => {
      // @author codex 本地标记执行中（立即更新按钮状态）
      setExecutingPlanCodes((prev) => new Set(prev).add(plan.planCode));
      toast.success(`已触发「${plan.planName}」，正在执行...`);

      try {
        const run = await startPlan(plan.planCode, plan.appCode);
        upsertRun(run);
        if (run.status === 'RUNNING') {
          toast.success(`执行批次已创建，共 ${run.totalCount} 条用例，正在执行...`);
        } else {
          toast.success(
            `执行完成！共 ${run.totalCount} 条，通过 ${run.passCount}，均分 ${run.avgScore}`,
          );
        }
      } catch {
        toast.error('触发执行失败，请稍后重试');
      } finally {
        setExecutingPlanCodes((prev) => {
          const next = new Set(prev);
          next.delete(plan.planCode);
          return next;
        });
        // @author codex 同步服务端最新状态，覆盖本地乐观合并数据
        await refresh();
      }
    },
    [refresh, upsertRun],
  );

  const handleDelete = useCallback(
    async (planCode: string) => {
      try {
        await deletePlan(planCode);
        toast.success('计划已删除');
        await refresh();
      } catch {
        toast.error('删除失败');
      }
    },
    [refresh],
  );

  const handleSavePlan = async () => {
    if (!form.planName.trim()) {
      toast.error('请输入计划名称');
      return;
    }
    if (form.scope === 'CATEGORY' && form.selectedCategories.size === 0) {
      toast.error('请至少选择一个分类');
      return;
    }

    setCreating(true);
    try {
      const caseFilter = buildCaseFilter(form);
      if (editingPlan) {
        await updatePlan(editingPlan.planCode, {
          planName: form.planName,
          appCode: editingPlan.appCode,
          caseFilter,
        });
        toast.success('计划已更新');
      } else {
        await createPlan({
          planName: form.planName,
          appCode,
          caseFilter,
        });
        toast.success('计划创建成功');
      }
      setDialogOpen(false);
      setEditingPlan(null);
      resetForm();
      await reload();
    } catch {
      toast.error(editingPlan ? '更新计划失败' : '创建计划失败');
    } finally {
      setCreating(false);
    }
  };

  const toggleCategory = (id: string) => {
    setForm((prev) => {
      const next = new Set(prev.selectedCategories);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, selectedCategories: next };
    });
  };

  // ── 渲染：计划列表视图 ──
  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Layers3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">执行计划</h1>
            <p className="text-sm text-muted-foreground">
              共 {plans.length} 个计划
              {plans.length > 0 && (
                <span className="ml-2">
                  · 总执行{' '}
                  {Array.from(totalRunsByPlan.values()).reduce((a, b) => a + b, 0)} 次
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 h-8"
            disabled={refreshing}
            onClick={() => void handleRefresh()}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            {refreshing ? '刷新中...' : '刷新'}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            新建计划
          </Button>
        </div>
      </div>

      {/* 计划列表 */}
      <div className="space-y-3">
        {loading && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 opacity-40" />
            加载中...
          </div>
        )}

        {!loading &&
          plans.map((plan) => (
            <PlanCard
              key={plan.planCode}
              plan={plan}
              runs={runsByPlan.get(plan.planCode) ?? []}
              totalRuns={totalRunsByPlan.get(plan.planCode) ?? 0}
              isLocalExecuting={executingPlanCodes.has(plan.planCode)}
              onRun={handleRun}
              onEdit={openEditDialog}
              onDelete={handleDelete}
              onSelectRun={openRunDetail}
              onOpenHistory={(p) =>
                setHistorySheet({ open: true, plan: p })
              }
            />
          ))}

        {!loading && plans.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Layers3 className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">暂无执行计划</p>
            <p className="text-xs mt-1 opacity-60">点击「新建计划」创建第一个测试计划</p>
          </div>
        )}
      </div>

      {/* 历史侧边栏 */}
      <PlanHistorySheet
        open={historySheet.open}
        onOpenChange={(open) => setHistorySheet((prev) => ({ ...prev, open }))}
        planName={historySheet.plan?.planName ?? ''}
        runs={historySheet.plan ? (runsByPlan.get(historySheet.plan.planCode) ?? []) : []}
        onSelectRun={(runCode) => {
          setHistorySheet({ open: false, plan: null });
          openRunDetail(runCode);
        }}
      />

      {/* 新建计划弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlan ? '编辑执行计划' : '新建执行计划'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="planName">计划名称</Label>
              <Input
                id="planName"
                placeholder="输入计划名称"
                value={form.planName}
                onChange={(e) => setForm({ ...form, planName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>执行范围</Label>
              <Select
                value={form.scope}
                onValueChange={(v: 'ALL' | 'CATEGORY') =>
                  setForm({ ...form, scope: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部应用用例</SelectItem>
                  <SelectItem value="CATEGORY">按分类执行</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.scope === 'CATEGORY' && (
              <div className="space-y-2 border rounded-md p-3 max-h-48 overflow-y-auto bg-muted/20">
                {categories.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-2">
                    暂无可用分类
                  </div>
                ) : (
                  categories.map((c) => {
                    const selected = form.selectedCategories.has(c.id);
                    return (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-muted rounded"
                        onClick={() => toggleCategory(c.id)}
                      >
                        <div className="text-primary">
                          {selected ? (
                            <CheckSquare className="h-4 w-4" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <span className="text-sm">{c.name}</span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSavePlan} disabled={creating}>
              {creating
                ? editingPlan ? '保存中...' : '创建中...'
                : editingPlan ? '保存修改' : '确认创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
