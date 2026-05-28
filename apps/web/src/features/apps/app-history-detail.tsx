'use client';
/**
 * 执行历史详情页
 * @author Antigravity/Claude-Sonnet-4.6
 * @author codex
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileJson,
  Eye,
  MessageSquare,
  Target,
  Timer,
  Braces,
  ChevronDown,
  ReceiptText,
  RefreshCw,
  AlertTriangle,
  Server,
  Bot,
  RotateCcw,
  PencilLine,
  Activity,
  Coins,
  MoreHorizontal,
  LayoutGrid,
  Folder,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { getErrorMessage } from '@/lib/error';
import {
  getRunStatus,
  listResults,
  listRunVersions,
  loadJudgeCallDetail,
  recalculateRunCost,
  reEvaluateResults,
  startPlan,
  submitResultReview,
  type JudgeCallDetail,
  type ResultRecord,
  type RunRecord,
  type RunVersionRecord,
} from './api/plan-execution-api';
import { toast } from 'sonner';
import { loadPlanCategories, type Category } from './use-plan-runs';

function formatJson(value?: Record<string, unknown>) {
  if (!value || Object.keys(value).length === 0) return '无';
  return JSON.stringify(value, null, 2);
}

interface AppHistoryDetailProps {
  runCode: string;
  backHref?: string;
  onBack?: () => void;
}

function getRunStatusLabel(status?: RunRecord['status']) {
  switch (status) {
    case 'RUNNING': return '执行中';
    case 'FAILED': return '失败';
    case 'CANCELLED': return '已取消';
    case 'COMPLETED': return '已完成';
    default: return '执行记录';
  }
}

function formatRunStartTime(run?: RunRecord | null) {
  if (!run?.startAt) return '';
  return new Date(run.startAt).toLocaleString('zh-CN');
}

function formatRunSequence(run?: Pick<RunRecord, 'sequenceNo'> | null) {
  return run?.sequenceNo ? `第 ${run.sequenceNo} 次` : '执行版本';
}

function formatRunVersionLabel(version: RunVersionRecord) {
  return `${formatRunSequence(version)} · ${version.totalCount} 条用例 · 均分 ${version.avgScore}`;
}

function formatNumber(value?: number | null) {
  return value === undefined || value === null ? '-' : value.toLocaleString('zh-CN');
}

function formatCurrencyAmount(value?: number | null, currency = 'CNY', emptyText = '未计费') {
  if (value === undefined || value === null) return emptyText;
  const amount = new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
  }).format(value);
  return `${amount} ${currency}`;
}

function formatCost(run?: RunRecord | null) {
  return formatCurrencyAmount(run?.totalCostAmount, run?.currency ?? 'CNY', '-');
}

function formatCostStatus(status?: RunRecord['costStatus']) {
  switch (status) {
    case 'CALCULATED': return '';
    case 'NO_USAGE': return '未计费';
    case 'SKIPPED_NO_PRICE': return '未配置价格';
    case 'PARTIAL': return '部分计费';
    default: return '未计费';
  }
}

function formatDurationText(ms?: number | null) {
  if (ms === undefined || ms === null || !Number.isFinite(ms)) return '-';
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}秒`;
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}分${seconds}秒`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes > 0 ? `${hours}小时${restMinutes}分` : `${hours}小时`;
}

function InlinePreview({ label, value, emptyText }: { label: string; value?: string; emptyText: string }) {
  const text = value || emptyText;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <p className="max-w-full truncate text-xs text-muted-foreground" title={text}>
          {label}：{text}
        </p>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-md whitespace-pre-wrap break-words leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

type ResultFilter = 'ALL' | 'PASS' | 'FAIL' | 'EXECUTION_FAILED';

function isExecutionFailed(result?: ResultRecord | null) {
  if (!result) return false;
  return result.appStatus === 'FAILED'
    || result.errorCode?.startsWith('EXECUTION_')
    || result.errorCode === 'APP_PROTOCOL_MISSING'
    || result.problemType === '接口调用失败';
}

function getEffectivePassStatus(result: ResultRecord) {
  return result.manualResult ?? result.passStatus;
}

function getPhaseStatusLabel(status?: ResultRecord['evaluationStatus']) {
  switch (status) {
    case 'PASSED':
      return '成功';
    case 'FAILED':
      return '失败';
    case 'RUNNING':
      return '执行中';
    case 'SKIPPED':
      return '已跳过';
    case 'PENDING':
      return '待处理';
    default:
      return '未返回';
  }
}

function getResultStatusConfig(result?: ResultRecord | null) {
  if (!result) {
    return {
      label: '执行记录',
      color: 'text-muted-foreground bg-muted border-border',
      icon: FileJson,
      conclusion: '等待结果',
    };
  }
  if (isExecutionFailed(result)) {
    return {
      label: '执行失败',
      color: 'text-red-500 bg-red-500/10 border-red-500/20',
      icon: AlertCircle,
      conclusion: '执行失败',
    };
  }
  if (result.manualResult) {
    return {
      label: result.manualResult === 'PASS' ? '人工修订通过' : '人工修订未达标',
      color: result.manualResult === 'PASS'
        ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
        : 'text-red-500 bg-red-500/10 border-red-500/20',
      icon: PencilLine,
      conclusion: '人工修订',
    };
  }
  switch (getEffectivePassStatus(result)) {
    case 'PASS':
      return {
        label: '评估通过',
        color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        icon: CheckCircle2,
        conclusion: '评估通过',
      };
    case 'FAIL':
      return {
        label: '未达标',
        color: 'text-red-500 bg-red-500/10 border-red-500/20',
        icon: AlertTriangle,
        conclusion: '评估未通过',
      };
    case 'REVIEW':
      return {
        label: '未达标',
        color: 'text-red-500 bg-red-500/10 border-red-500/20',
        icon: AlertTriangle,
        conclusion: '评估未通过',
      };
    default:
      return {
        label: result.passStatus,
        color: 'text-muted-foreground bg-muted border-border',
        icon: FileJson,
        conclusion: '评估结论',
      };
  }
}

function JsonPanel({ label, value }: { label: string; value?: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Braces className="h-3.5 w-3.5" />
        {label}
      </p>
      <pre className="max-h-60 overflow-auto rounded-lg border border-border/50 bg-muted/40 p-3 text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap break-all">
        {formatJson(value)}
      </pre>
    </div>
  );
}

function buildRunVersionHref(backHref: string | undefined, nextRunCode: string) {
  const encodedRunCode = encodeURIComponent(nextRunCode);
  const normalizedBackHref = backHref?.replace(/\/$/u, '');
  if (normalizedBackHref?.endsWith('/plans')) return `${normalizedBackHref}/runs/${encodedRunCode}`;
  if (normalizedBackHref?.endsWith('/history')) return `${normalizedBackHref}/${encodedRunCode}`;
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/plans/runs/')) {
      return currentPath.replace(/\/plans\/runs\/[^/]+$/u, `/plans/runs/${encodedRunCode}`);
    }
    if (currentPath.includes('/history/')) {
      return currentPath.replace(/\/history\/[^/]+$/u, `/history/${encodedRunCode}`);
    }
  }
  return encodedRunCode;
}

export function AppHistoryDetail({ runCode, backHref, onBack }: AppHistoryDetailProps) {
  const router = useRouter();
  const [run, setRun] = useState<RunRecord | null>(null);
  const [results, setResults] = useState<ResultRecord[]>([]);
  const [versions, setVersions] = useState<RunVersionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ResultFilter>('ALL');
  // 左侧分类导航选中的 categoryId，'ALL' 表示全部
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCase, setSelectedCase] = useState<ResultRecord | null>(null);
  const [judgeCall, setJudgeCall] = useState<JudgeCallDetail | null>(null);
  const [judgeCallLoading, setJudgeCallLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [retryingKey, setRetryingKey] = useState<string | null>(null);
  const [reviewSaving, setReviewSaving] = useState<'PASS' | 'FAIL' | 'CLEAR' | null>(null);
  const [reEvaluatingId, setReEvaluatingId] = useState<string | null>(null);

  const loadResults = useCallback(async () => {
    try {
      setLoading(true);
      const [currentRun, resultList, versionList] = await Promise.all([
        getRunStatus(runCode),
        listResults(runCode),
        listRunVersions(runCode),
      ]);
      const categoryList = currentRun ? await loadPlanCategories(currentRun.appCode) : [];
      setRun(currentRun);
      setResults(resultList);
      setVersions(versionList);
      setCategories(categoryList);
    } catch (error: unknown) {
      toast.error(`加载执行详情失败: ${getErrorMessage(error, '请求失败')}`);
    } finally {
      setLoading(false);
    }
  }, [runCode]);

  useEffect(() => { void loadResults(); }, [loadResults]);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (backHref) {
      router.push(backHref);
      return;
    }
    router.back();
  };

  const categoryResults = useMemo(() => {
    if (selectedCategory === 'ALL') return results;
    return results.filter(r => (r.categoryId ?? '__none__') === selectedCategory);
  }, [results, selectedCategory]);

  const total = categoryResults.length;
  const passed = categoryResults.filter(r => getEffectivePassStatus(r) === 'PASS' && !isExecutionFailed(r)).length;
  const executionFailed = categoryResults.filter(isExecutionFailed).length;
  const failed = categoryResults.filter(r => getEffectivePassStatus(r) !== 'PASS' && !isExecutionFailed(r)).length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const allPassed = total > 0 && passed === total && failed === 0 && executionFailed === 0;

  // 分类汇总：{ categoryId -> { name, total, passed } }
  const categoryStats = useMemo(() => {
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));
    const map = new Map<string, { name: string; total: number; passed: number }>();
    for (const r of results) {
      const catId = r.categoryId ?? '__none__';
      const catName = catId === '__none__' ? '未分类' : (categoryMap.get(catId) ?? catId);
      const existing = map.get(catId) ?? { name: catName, total: 0, passed: 0 };
      existing.total += 1;
      if (getEffectivePassStatus(r) === 'PASS' && !isExecutionFailed(r)) existing.passed += 1;
      map.set(catId, existing);
    }
    return Array.from(map.entries()).map(([id, stat]) => ({ id, ...stat }));
  }, [results, categories]);

  const filteredResults = results.filter(r => {
    const catMatch = selectedCategory === 'ALL' || (r.categoryId ?? '__none__') === selectedCategory;
    if (!catMatch) return false;
    if (filter === 'ALL') return true;
    if (filter === 'EXECUTION_FAILED') return isExecutionFailed(r);
    if (filter === 'FAIL') return getEffectivePassStatus(r) !== 'PASS' && !isExecutionFailed(r);
    return getEffectivePassStatus(r) === filter && !isExecutionFailed(r);
  });
  const taskName = run?.planName || run?.planCode || '执行记录详情';
  const startTime = formatRunStartTime(run);
  const currentVersionLabel = formatRunSequence(run);
  const runDuration = run?.durationMs !== undefined && run.durationMs !== null ? formatDurationText(run.durationMs) : '';
  const costStatusLabel = formatCostStatus(run?.costStatus);
  const costSummaryValue = !run ? '-' : run.costStatus === 'CALCULATED' ? formatCost(run) : costStatusLabel;

  const handleSelectVersion = (nextRunCode: string) => {
    if (nextRunCode === runCode) return;
    router.push(buildRunVersionHref(backHref, nextRunCode));
  };

  const handleRecalculateCost = async () => {
    try {
      setRecalculating(true);
      const nextRun = await recalculateRunCost(runCode);
      setRun((prev) => (prev
        ? {
            ...prev,
            ...nextRun,
            planName: nextRun.planName ?? prev.planName,
            sequenceNo: nextRun.sequenceNo ?? prev.sequenceNo,
          }
        : nextRun));
      toast.success('费用已重新计算');
    } catch {
      toast.error('重新计算费用失败');
    } finally {
      setRecalculating(false);
    }
  };

  const handleRetry = async (caseCodes?: string[]) => {
    if (!run) return;
    const retryKey = caseCodes?.[0] ?? '__all__';
    try {
      setRetryingKey(retryKey);
      const nextRun = await startPlan(run.planCode, run.appCode, caseCodes);
      toast.success(caseCodes?.length ? '已触发单条重试' : '已触发全量重试');
      router.push(buildRunVersionHref(backHref, nextRun.runCode));
    } catch {
      toast.error(caseCodes?.length ? '单条重试失败' : '全量重试失败');
    } finally {
      setRetryingKey(null);
    }
  };

  /** 仅重新发起 AI 评估，不重调业务接口 */
  const handleReEvaluate = async (res: ResultRecord) => {
    try {
      setReEvaluatingId(res.resultId);
      const updated = await reEvaluateResults([res.resultId]);
      if (updated.length > 0) {
        setResults(current => current.map(r => r.resultId === res.resultId ? { ...r, ...updated[0] } : r));
        // 如果详情面板当前打开的就是这条，同步更新
        setSelectedCase(current => current?.resultId === res.resultId ? { ...current, ...updated[0] } : current);
      }
      toast.success('重新评估已完成');
    } catch {
      toast.error('重新评估失败');
    } finally {
      setReEvaluatingId(null);
    }
  };

  const handleLoadJudgeCall = async () => {
    if (!selectedCase) return;
    try {
      setJudgeCallLoading(true);
      setJudgeCall(await loadJudgeCallDetail(selectedCase.resultId));
    } catch {
      toast.error('加载评估调用失败');
    } finally {
      setJudgeCallLoading(false);
    }
  };

  const handleManualReview = async (result: ResultRecord, manualResult: 'PASS' | 'FAIL' | null) => {
    const savingKey = manualResult ?? 'CLEAR';
    try {
      setReviewSaving(savingKey);
      const reviewRecord = await submitResultReview({
        resultId: result.resultId,
        manualResult,
      });
      const nextManualResult = manualResult === null ? undefined : (reviewRecord.manualResult ?? manualResult);
      const nextCase: ResultRecord = {
        ...result,
        manualResult: nextManualResult,
        reviewStatus: reviewRecord.reviewStatus,
        reviewComment: reviewRecord.reviewComment,
      };
      setSelectedCase((current) => (current?.resultId === nextCase.resultId ? nextCase : current));
      setResults((current) => current.map((result) => (result.resultId === nextCase.resultId ? nextCase : result)));
      toast.success(manualResult === null ? '已恢复 AI 评估' : '人工修订已保存');
    } catch {
      toast.error('保存人工修订失败');
    } finally {
      setReviewSaving(null);
    }
  };

  const selectedStatus = getResultStatusConfig(selectedCase);
  const SelectedStatusIcon = selectedStatus.icon;

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-5 flex flex-col h-full">
      <div className="flex flex-col gap-3 shrink-0 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">执行详情：{taskName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 rounded-full px-2.5 text-xs font-medium"
                  >
                    {currentVersionLabel}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    选择执行版本
                  </DropdownMenuLabel>
                  {versions.map((version) => (
                    <DropdownMenuItem
                      key={version.runCode}
                      disabled={version.runCode === runCode}
                      className="justify-between gap-3"
                      onSelect={() => handleSelectVersion(version.runCode)}
                    >
                      <span>{formatRunVersionLabel(version)}</span>
                      {version.runCode === runCode && (
                        <span className="text-[10px] text-primary">当前</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <span>{getRunStatusLabel(run?.status)}</span>
              {startTime && <span>{startTime}</span>}
              {runDuration && <span>总耗时 {runDuration}</span>}
            </div>
          </div>
        </div>
        {run && !allPassed && (
          <Button
            variant="outline"
            size="sm"
            className="w-fit gap-1.5 lg:self-center"
            onClick={() => void handleRetry()}
            disabled={retryingKey === '__all__' || run.status === 'RUNNING'}
          >
            <RotateCcw className={cn('h-4 w-4', retryingKey === '__all__' && 'animate-spin')} />
            全量重试
          </Button>
        )}
      </div>

      <div className="shrink-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['总用例数', total, 'text-foreground'],
            ['达标率', `${passRate}%`, 'text-foreground'],
            ['评估通过', passed, 'text-emerald-500'],
            ['未达标 / 执行失败', `${failed} / ${executionFailed}`, 'text-red-500'],
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-xl border border-border/50 bg-muted/45 px-4 py-3 dark:bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className={cn('mt-1 text-2xl font-bold leading-none', color)}>{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid [grid-template-columns:repeat(auto-fit,minmax(136px,1fr))] gap-2 border-t border-border/70 pt-3 text-xs">
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border/50 bg-muted/35 px-3 py-2 dark:bg-background">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="min-w-0 truncate text-muted-foreground">普通输入</span>
            <span className="ml-auto font-semibold text-foreground">{formatNumber(run?.normalInputTokens)}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border/50 bg-muted/35 px-3 py-2 dark:bg-background">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="min-w-0 truncate text-muted-foreground">缓存命中</span>
            <span className="ml-auto font-semibold text-foreground">{formatNumber(run?.cachedInputTokens)}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border/50 bg-muted/35 px-3 py-2 dark:bg-background">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="min-w-0 truncate text-muted-foreground">输出</span>
            <span className="ml-auto font-semibold text-foreground">{formatNumber(run?.outputTokens)}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border/50 bg-muted/35 px-3 py-2 dark:bg-background">
            <Coins className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="min-w-0 truncate text-muted-foreground">费用</span>
            <span className="ml-auto font-semibold text-foreground">{costSummaryValue}</span>
            {run && run.costStatus !== 'CALCULATED' && (
              <Button
                size="icon"
                variant="ghost"
                className="-mr-1 h-6 w-6 shrink-0"
                aria-label="重新计算费用"
                onClick={() => void handleRecalculateCost()}
                disabled={recalculating}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', recalculating && 'animate-spin')} />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex gap-4">
        {/* 左侧分类导航 */}
        {categoryStats.length > 1 && (
          <div className="w-48 shrink-0 border border-border bg-card rounded-xl flex flex-col overflow-hidden">
            <div className="p-3 border-b border-border text-xs font-semibold text-muted-foreground bg-muted/20">用例分类</div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-2 rounded-md text-sm transition-colors text-left',
                  selectedCategory === 'ALL' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground',
                )}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">全部</span>
                </span>
                <span className="text-[10px] shrink-0 ml-1">{results.length}</span>
              </button>
              {categoryStats.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-2 rounded-md text-sm transition-colors text-left',
                    selectedCategory === cat.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground',
                  )}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Folder className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate text-xs">{cat.name}</span>
                  </span>
                  <span className={cn(
                    'text-[10px] shrink-0 ml-1 font-medium',
                    cat.passed === cat.total ? 'text-emerald-500' : 'text-red-400',
                  )}>
                    {cat.passed}/{cat.total}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 右侧：Tab 过滤 + 结果列表 */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col space-y-3">
          <div className="flex items-center justify-between overflow-x-auto pb-1">
            <Tabs value={filter} onValueChange={(value) => setFilter(value as ResultFilter)}>
              <TabsList>
                <TabsTrigger value="ALL">全部 ({total})</TabsTrigger>
                <TabsTrigger value="PASS">评估通过 ({passed})</TabsTrigger>
                <TabsTrigger value="FAIL">未达标 ({failed})</TabsTrigger>
                <TabsTrigger value="EXECUTION_FAILED">执行失败 ({executionFailed})</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

            <div className="flex-1 overflow-y-auto bg-card border border-border rounded-xl shadow-sm">
              {loading && <div className="text-center py-12 text-muted-foreground">加载中...</div>}

              {!loading && filteredResults.length > 0 && (
                <div className="divide-y divide-border">
                  {filteredResults.map((res) => {
                    const s = getResultStatusConfig(res);
                    const StatusIcon = s.icon;
                    const questionText = res.query || res.caseCode || '（无问题内容）';
                    const canRetryCase = isExecutionFailed(res);
                    const isFail = !canRetryCase && getEffectivePassStatus(res) !== 'PASS';
                    const isReEvaluating = reEvaluatingId === res.resultId;
                    return (
                      <div
                        key={res.resultId}
                        data-result-row
                        className="flex flex-col gap-4 p-4 transition-colors hover:bg-muted/40 lg:flex-row lg:items-start lg:justify-between"
                      >
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <StatusIcon className={cn('h-5 w-5 shrink-0', s.color.split(' ')[0])} />
                          <div className="min-w-0 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={cn('text-[10px] px-1.5 h-5 rounded-full border', s.color)}>
                                {s.label}
                              </Badge>
                              {res.elapsedMs !== undefined && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Timer className="h-3.5 w-3.5" />
                                  耗时 {formatDurationText(res.elapsedMs)}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-foreground break-all">{questionText}</p>
                            <p className="text-xs text-muted-foreground break-all">期望回答：{res.expectedBehavior || '未配置'}</p>
                            <InlinePreview label="实际回答" value={res.finalAnswer} emptyText="无返回内容" />
                            {res.failureReason && <InlinePreview label="评估结论" value={res.failureReason} emptyText="后端未返回评估结论" />}
                            {res.manualResult && (
                              <Badge variant="outline" className="h-5 rounded-full border-amber-500/20 bg-amber-500/10 px-1.5 text-[10px] text-amber-600">
                                人工修订
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex w-full flex-wrap items-center justify-end gap-2 lg:ml-4 lg:w-auto lg:shrink-0 lg:gap-3">
                          <div className="text-right mr-4 hidden sm:block">
                            <span className="text-lg font-bold font-mono">{res.finalScore !== undefined ? res.finalScore : '-'}</span>
                            <span className="text-xs text-muted-foreground ml-1">分</span>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => setSelectedCase(res)}>
                            <Eye className="h-4 w-4 mr-1.5" />
                            查看明细
                          </Button>
                          {canRetryCase ? (
                            /* 执行失败：下拉提供「重新业务调用+评估」和「仅重新评估」 */
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={retryingKey === res.caseCode || isReEvaluating || !run || run.status === 'RUNNING'}
                                >
                                  {(retryingKey === res.caseCode || isReEvaluating)
                                    ? <RotateCcw className="h-4 w-4 mr-1.5 animate-spin" />
                                    : <RotateCcw className="h-4 w-4 mr-1.5" />}
                                  重试
                                  <ChevronDown className="h-3.5 w-3.5 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onSelect={() => void handleRetry([res.caseCode])}>
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  重新业务调用+评估
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => void handleReEvaluate(res)}>
                                  <Sparkles className="h-4 w-4 mr-2" />
                                  仅重新 AI 评估
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : isFail ? (
                            /* 未达标：修订结果下拉（含重新评估） */
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  aria-label={`修订结果：${questionText}`}
                                  disabled={isReEvaluating}
                                >
                                  {isReEvaluating
                                    ? <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                                    : <MoreHorizontal className="h-4 w-4 mr-1.5" />}
                                  修订结果
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onSelect={() => void handleReEvaluate(res)}>
                                  <Sparkles className="h-4 w-4 mr-2" />
                                  重新自动评估
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {getEffectivePassStatus(res) !== 'PASS' && (
                                  <DropdownMenuItem onSelect={() => void handleManualReview(res, 'PASS')}>
                                    标为评估通过
                                  </DropdownMenuItem>
                                )}
                                {getEffectivePassStatus(res) === 'PASS' && (
                                  <DropdownMenuItem onSelect={() => void handleManualReview(res, 'FAIL')}>
                                    标为未达标
                                  </DropdownMenuItem>
                                )}
                                {res.manualResult && (
                                  <DropdownMenuItem onSelect={() => void handleManualReview(res, null)}>
                                    恢复 AI 评估
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            /* 评估通过：仅保留修订功能 */
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  aria-label={`修订结果：${questionText}`}
                                >
                                  <MoreHorizontal className="h-4 w-4 mr-1.5" />
                                  修订结果
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                {getEffectivePassStatus(res) !== 'PASS' && (
                                  <DropdownMenuItem onSelect={() => void handleManualReview(res, 'PASS')}>
                                    标为评估通过
                                  </DropdownMenuItem>
                                )}
                                {getEffectivePassStatus(res) === 'PASS' && (
                                  <DropdownMenuItem onSelect={() => void handleManualReview(res, 'FAIL')}>
                                    标为未达标
                                  </DropdownMenuItem>
                                )}
                                {res.manualResult && (
                                  <DropdownMenuItem onSelect={() => void handleManualReview(res, null)}>
                                    恢复 AI 评估
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!loading && filteredResults.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <FileJson className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">没有匹配的用例</p>
                </div>
              )}
            </div>
          </div>
        </div>

      <Sheet open={!!selectedCase} onOpenChange={(open) => {
        if (!open) {
          setSelectedCase(null);
          setJudgeCall(null);
        }
      }}>
        <SheetContent side="right" className="w-[720px] max-w-[94vw] p-0">
          <SheetHeader className="space-y-3 border-b border-border/70 px-6 py-5">
            <div className="flex items-start gap-3 pr-8">
              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', selectedStatus.color)}>
                <SelectedStatusIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <SheetTitle className="flex items-center gap-2 text-lg leading-6">
                  <span className="truncate">{selectedCase?.query || selectedCase?.caseCode}</span>
                </SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-2">
                  执行结果详情与 AI 裁判评价
                  {selectedCase?.manualResult && (
                    <Badge variant="outline" className="rounded-full border-amber-500/20 bg-amber-500/10 text-amber-600">
                      人工修订
                    </Badge>
                  )}
                </SheetDescription>
              </div>
              {selectedCase && (
                <Badge variant="outline" className={cn('text-xs border', selectedStatus.color)}>
                  {selectedStatus.label}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">总得分</p>
                <p className="mt-1 text-lg font-bold text-foreground">{selectedCase?.finalScore ?? '-'} 分</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">总耗时</p>
                <p className="mt-1 text-lg font-bold text-foreground">{formatDurationText(selectedCase?.elapsedMs)}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">评估调用</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {getPhaseStatusLabel(selectedCase?.evaluationStatus)}
                </p>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto space-y-4 px-6 py-5">
            <div className="space-y-2 rounded-xl border border-border/60 bg-card p-4">
              <div className="grid gap-3 text-sm">
                <div className="grid gap-2 md:grid-cols-[88px_1fr]">
                  <h4 className="flex items-center gap-2 font-semibold text-foreground">
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                    问题内容
                  </h4>
                  <p className="min-w-0 break-all text-foreground/90">
                    {selectedCase?.query || <span className="text-muted-foreground italic">无问题内容</span>}
                  </p>
                </div>
                <div className="grid gap-2 md:grid-cols-[88px_1fr]">
                  <h4 className="flex items-center gap-2 font-semibold text-foreground">
                    <Target className="h-4 w-4 text-emerald-500" />
                    期望回答
                  </h4>
                  <p className="min-w-0 break-all text-foreground/90">
                    {selectedCase?.expectedBehavior || <span className="text-muted-foreground italic">未配置期望回答</span>}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-border/60 bg-card p-4">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Bot className="h-4 w-4 text-blue-500" />
                大模型实际返回
              </h4>
              <div className="max-h-48 overflow-auto rounded-lg bg-muted/30 p-3 text-sm text-foreground/90 whitespace-pre-wrap break-all">
                {selectedCase?.finalAnswer || <span className="text-muted-foreground italic">无返回内容</span>}
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-border/60 bg-card p-4">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                评估结论
                <Badge variant="outline" className={cn('ml-1 h-5 rounded-full text-[10px] border', selectedStatus.color)}>
                  {selectedStatus.conclusion}
                </Badge>
              </h4>
              <div className="rounded-lg bg-primary/5 p-3 text-sm text-foreground/90 whitespace-pre-wrap break-all">
                {selectedCase?.failureReason || <span className="text-muted-foreground italic">后端未返回评估结论。</span>}
              </div>
              {selectedCase && !isExecutionFailed(selectedCase) && (
                <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                  <span className="text-xs text-muted-foreground">人工修订：</span>
                  {getEffectivePassStatus(selectedCase) !== 'PASS' && (
                    <Button
                      size="sm"
                      variant={selectedCase.manualResult === 'PASS' ? 'default' : 'outline'}
                      onClick={() => void handleManualReview(selectedCase, 'PASS')}
                      disabled={reviewSaving !== null}
                    >
                      {reviewSaving === 'PASS' && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                      改为通过
                    </Button>
                  )}
                  {getEffectivePassStatus(selectedCase) === 'PASS' && (
                    <Button
                      size="sm"
                      variant={selectedCase.manualResult === 'FAIL' ? 'default' : 'outline'}
                      onClick={() => void handleManualReview(selectedCase, 'FAIL')}
                      disabled={reviewSaving !== null}
                    >
                      {reviewSaving === 'FAIL' && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                      改为未达标
                    </Button>
                  )}
                  {selectedCase.manualResult && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleManualReview(selectedCase, null)}
                      disabled={reviewSaving !== null}
                    >
                      {reviewSaving === 'CLEAR' && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                      恢复 AI 评估
                    </Button>
                  )}
                </div>
              )}
            </div>

            {(selectedCase?.errorCode || selectedCase?.problemType || isExecutionFailed(selectedCase)) && (
              <div className="space-y-2 rounded-xl border border-destructive/15 bg-destructive/5 p-4">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  异常信息
                </h4>
                <div className="space-y-1 text-sm text-foreground/90">
                  {selectedCase?.errorCode && <p>错误码：{selectedCase.errorCode}</p>}
                  {selectedCase?.problemType && <p>问题类型：{selectedCase.problemType}</p>}
                </div>
                {selectedCase && isExecutionFailed(selectedCase) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => void handleRetry([selectedCase.caseCode])}
                    disabled={retryingKey === selectedCase.caseCode || !run || run.status === 'RUNNING'}
                  >
                    <RotateCcw className={cn('h-4 w-4', retryingKey === selectedCase.caseCode && 'animate-spin')} />
                    重试本条
                  </Button>
                )}
              </div>
            )}

            <details className="group rounded-xl border border-border/60 bg-card p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-foreground">
                <span className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  接口调用
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <JsonPanel label="请求 JSON" value={selectedCase?.requestJson} />
                <JsonPanel label="响应 JSON" value={selectedCase?.responseJson} />
              </div>
            </details>

            <details className="group rounded-xl border border-border/60 bg-card p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-foreground">
                <span className="flex items-center gap-2">
                  <ReceiptText className="h-4 w-4 text-muted-foreground" />
                  评估调用
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">默认收起，仅在需要排查裁判输入输出时展开。</p>
                  <Button size="sm" variant="outline" onClick={() => void handleLoadJudgeCall()} disabled={judgeCallLoading}>
                    {judgeCallLoading ? '加载中...' : judgeCall ? '刷新审计' : '加载审计'}
                  </Button>
                </div>
                {judgeCall ? (
                  <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/30 p-3 text-xs md:grid-cols-4">
                      <div>状态：{judgeCall.status}</div>
                      <div>模型：{judgeCall.modelId}</div>
                      <div>Token：{formatNumber(judgeCall.totalTokens)}</div>
                      <div>费用：{formatCurrencyAmount(judgeCall.totalCostAmount, judgeCall.currency ?? 'CNY', '-')}</div>
                    </div>
                    {judgeCall.errorMessage && <p className="text-xs text-destructive">{judgeCall.errorMessage}</p>}
                    <div className="grid gap-4 md:grid-cols-2">
                      <JsonPanel label="评估请求 JSON" value={judgeCall.requestJson} />
                      <JsonPanel label="评估响应 JSON" value={judgeCall.responseJson} />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">
                    展开后点击“加载审计”查看评估模型的完整输入输出。
                  </div>
                )}
              </div>
            </details>
          </div>
        </SheetContent>
      </Sheet>
    </div>
    </TooltipProvider>
  );
}
