'use client';
/**
 * 执行历史详情页
 * @author codex
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, AlertCircle, FileJson, Eye, MessageSquare, Target, Timer, Braces, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { getRunStatus, listResults, listRunVersions, type ResultRecord, type RunRecord, type RunVersionRecord } from './api/plan-execution-api';
import { toast } from 'sonner';

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
  const [filter, setFilter] = useState<string>('ALL');
  const [selectedCase, setSelectedCase] = useState<ResultRecord | null>(null);

  const loadResults = useCallback(async () => {
    try {
      setLoading(true);
      const [runResult, resultResult, versionsResult] = await Promise.allSettled([
        getRunStatus(runCode),
        listResults(runCode),
        listRunVersions(runCode),
      ]);
      if (runResult.status === 'fulfilled') setRun(runResult.value);
      if (resultResult.status === 'fulfilled') {
        setResults(resultResult.value);
      } else {
        throw resultResult.reason;
      }
      if (versionsResult.status === 'fulfilled') {
        setVersions(versionsResult.value);
      } else if (runResult.status === 'fulfilled' && runResult.value) {
        setVersions([runResult.value]);
      }
    } catch {
      toast.error('加载执行详情失败');
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

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PASS': return { label: '通过', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 };
      case 'FAIL': return { label: '未达标', color: 'text-red-500 bg-red-500/10 border-red-500/20', icon: AlertCircle };
      case 'REVIEW': return { label: '待人工确认', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', icon: AlertCircle };
      case 'RUNNING': return { label: '执行中', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20', icon: AlertCircle };
      default: return { label: status, color: 'text-muted-foreground bg-muted border-border', icon: FileJson };
    }
  };

  const total = results.length;
  const passed = results.filter(r => r.passStatus === 'PASS').length;
  const failed = results.filter(r => r.passStatus === 'FAIL').length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  const filteredResults = results.filter(r => {
    if (filter === 'ALL') return true;
    return r.passStatus === filter;
  });
  const taskName = run?.planName || run?.planCode || '执行记录详情';
  const startTime = formatRunStartTime(run);
  const currentVersionLabel = formatRunSequence(run);

  const handleSelectVersion = (nextRunCode: string) => {
    if (nextRunCode === runCode) return;
    router.push(buildRunVersionHref(backHref, nextRunCode));
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex items-center justify-between shrink-0">
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
              {startTime && <span>· {startTime}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-sm text-muted-foreground font-medium mb-1">总用例数</p>
          <p className="text-3xl font-bold text-foreground">{total}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-sm text-muted-foreground font-medium mb-1">通过率</p>
          <p className="text-3xl font-bold text-foreground">{passRate}%</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-sm text-muted-foreground font-medium mb-1">通过</p>
          <p className="text-3xl font-bold text-emerald-500">{passed}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-sm text-muted-foreground font-medium mb-1">失败</p>
          <p className="text-3xl font-bold text-red-500">{failed}</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="ALL">全部 ({total})</TabsTrigger>
              <TabsTrigger value="PASS">通过 ({passed})</TabsTrigger>
              <TabsTrigger value="FAIL">失败 ({failed})</TabsTrigger>
              <TabsTrigger value="REVIEW">待确认 ({results.filter(r => r.passStatus === 'REVIEW').length})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-y-auto bg-card border border-border rounded-xl shadow-sm">
          {loading && <div className="text-center py-12 text-muted-foreground">加载中...</div>}

          {!loading && filteredResults.length > 0 && (
            <div className="divide-y divide-border">
              {filteredResults.map((res) => {
                const s = getStatusConfig(res.passStatus);
                const StatusIcon = s.icon;
                const questionText = res.query || res.caseCode || '（无问题内容）';
                return (
                  <div key={res.resultId} className="flex items-start justify-between gap-4 p-4 hover:bg-muted/30 transition-colors">
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
                              耗时 {res.elapsedMs}ms
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-foreground break-all">{questionText}</p>
                        <p className="text-xs text-muted-foreground break-all">期望回答：{res.expectedBehavior || '未配置'}</p>
                        <p className="text-xs text-muted-foreground break-all">实际回答：{res.finalAnswer || '无返回内容'}</p>
                        {res.failureReason && (
                          <p className="text-xs text-muted-foreground break-all">评分依据：{res.failureReason}</p>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 ml-4 flex items-center gap-3">
                      <div className="text-right mr-4 hidden sm:block">
                        <span className="text-lg font-bold font-mono">{res.finalScore !== undefined ? res.finalScore : '-'}</span>
                        <span className="text-xs text-muted-foreground ml-1">分</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setSelectedCase(res)}>
                        <Eye className="h-4 w-4 mr-1.5" />
                        查看明细
                      </Button>
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

      <Dialog open={!!selectedCase} onOpenChange={(open) => !open && setSelectedCase(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <span className="truncate">{selectedCase?.query || selectedCase?.caseCode}</span>
              {selectedCase && (
                <Badge variant="outline" className={cn('text-xs border', getStatusConfig(selectedCase.passStatus).color)}>
                  {getStatusConfig(selectedCase.passStatus).label}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              执行结果详情与 AI 裁判评价。总得分: {selectedCase?.finalScore}分
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-2">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                  问题内容
                </h4>
                <div className="bg-muted/30 border border-border/50 rounded-lg p-4 text-sm text-foreground/90 whitespace-pre-wrap break-all min-h-24">
                  {selectedCase?.query || <span className="text-muted-foreground italic">无问题内容</span>}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Target className="h-4 w-4 text-emerald-500" />
                  期望回答
                </h4>
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-4 text-sm text-foreground/90 whitespace-pre-wrap break-all min-h-24">
                  {selectedCase?.expectedBehavior || <span className="text-muted-foreground italic">未配置期望回答</span>}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                大模型实际返回
              </h4>
              <div className="bg-muted/30 border border-border/50 rounded-lg p-4 text-sm text-foreground/90 whitespace-pre-wrap break-all min-h-[100px]">
                {selectedCase?.finalAnswer || <span className="text-muted-foreground italic">无返回内容</span>}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
                评分依据
              </h4>
              <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 text-sm text-foreground/90 whitespace-pre-wrap break-all min-h-[100px]">
                {selectedCase?.failureReason || <span className="text-muted-foreground italic">后端未返回评分依据。</span>}
              </div>
            </div>

            {(selectedCase?.errorCode || selectedCase?.problemType) && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  异常信息
                </h4>
                <div className="bg-destructive/5 border border-destructive/10 rounded-lg p-4 text-sm text-foreground/90 whitespace-pre-wrap break-all">
                  {selectedCase.errorCode && <p>错误码：{selectedCase.errorCode}</p>}
                  {selectedCase.problemType && <p>问题类型：{selectedCase.problemType}</p>}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Braces className="h-4 w-4 text-muted-foreground" />
                  请求 JSON
                </h4>
                <pre className="bg-muted/40 border border-border/50 rounded-lg p-4 text-xs text-foreground/90 overflow-x-auto whitespace-pre-wrap break-all min-h-32">
                  {formatJson(selectedCase?.requestJson)}
                </pre>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Braces className="h-4 w-4 text-muted-foreground" />
                  响应 JSON
                </h4>
                <pre className="bg-muted/40 border border-border/50 rounded-lg p-4 text-xs text-foreground/90 overflow-x-auto whitespace-pre-wrap break-all min-h-32">
                  {formatJson(selectedCase?.responseJson)}
                </pre>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
