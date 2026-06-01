'use client';

/**
 * @author qtp
 * 执行对比屏：基线 vs 候选，识别新增/修复/持续失败 + 发布建议。
 * 设计依据：docs/20260529-003-失败诊断与执行对比设计规格.md
 */
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, GitCompare, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/badge';
import type { ComparisonView, DiffRow, ResultChange } from '@/lib/server/qtp-queries';

const REC: Record<string, { label: string; cls: string }> = {
  PASS: { label: '可发布', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  WATCH: { label: '需关注', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  MANUAL: { label: '需人工评估', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  REJECT: { label: '不建议发布', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  BLOCK: { label: '阻断发布', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
};

const CHANGE: Record<ResultChange, { label: string; cls: string }> = {
  NEW_FAIL: { label: '新增失败', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  PERSIST_FAIL: { label: '持续失败', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  FIXED: { label: '修复', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  STABLE_PASS: { label: '稳定通过', cls: 'bg-muted text-muted-foreground' },
  OTHER: { label: '变化', cls: 'bg-muted text-muted-foreground' },
};

const FILTERS = [
  { key: 'NEW_FAIL', label: '新增失败' },
  { key: 'ALL', label: '全部' },
  { key: 'FIXED', label: '修复' },
  { key: 'PERSIST_FAIL', label: '持续失败' },
  { key: 'DIFF', label: '仅看差异' },
] as const;

const pct = (n: number | null | undefined) => (n == null ? '—' : `${(n * 100).toFixed(1)}%`);
const delta = (n: number | null | undefined) => (n == null ? '—' : `${n > 0 ? '+' : ''}${(n * 100).toFixed(1)}%`);

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-xl border border-border bg-card', className)}>{children}</div>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'PASS') return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent">通过</Badge>;
  if (status === 'FAIL') return <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border-transparent">失败</Badge>;
  if (status === 'REVIEW') return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent">复核</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function VersionCardBlock({ title, version, passRate, pass, total, accent }: { title: string; version: ComparisonView['baseline']['version']; passRate: number; pass: number; total: number; accent: string }) {
  return (
    <Card className="flex-1 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">{title}</span>
        <span className={cn('text-xs font-medium', accent)}>{version?.versionType}</span>
      </div>
      <div className="mt-1 text-lg font-semibold text-foreground">{version?.versionCode ?? '—'}</div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {version?.promptVersion && <span>Prompt：{version.promptVersion}</span>}
        {version?.modelVersion && <span>模型：{version.modelVersion}</span>}
        {version?.commitId && <span>Commit：{version.commitId}</span>}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">{pct(passRate)}</span>
        <span className="text-xs text-muted-foreground">通过率（{pass}/{total}）</span>
      </div>
      {version?.changeNote && <p className="mt-2 text-xs text-muted-foreground">{version.changeNote}</p>}
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-2xl font-bold', tone ?? 'text-foreground')}>{value}</div>
    </Card>
  );
}

export function ComparisonScreen({ data }: { data: ComparisonView }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('NEW_FAIL');
  const rec = data.releaseRecommendation ? REC[data.releaseRecommendation] : null;

  const rows = data.rows.filter((r) => {
    if (filter === 'ALL') return true;
    if (filter === 'DIFF') return r.change !== 'STABLE_PASS';
    return r.change === filter;
  });

  const degradation = data.summary.degradationByType ?? {};

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* 头部 */}
      <div className="flex items-center gap-3">
        <GitCompare className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">执行对比 · {data.appName}</h1>
          <p className="text-sm text-muted-foreground">{data.comparisonCode}　基线 vs 候选回归结果</p>
        </div>
      </div>

      {/* 版本对比卡 */}
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        <VersionCardBlock title="基线版本" version={data.baseline.version} passRate={data.baseline.passRate} pass={data.baseline.pass} total={data.baseline.total} accent="text-muted-foreground" />
        <div className="flex items-center justify-center px-1 text-sm font-bold text-muted-foreground/50">VS</div>
        <VersionCardBlock title="候选版本" version={data.candidate.version} passRate={data.candidate.passRate} pass={data.candidate.pass} total={data.candidate.total} accent="text-primary" />
      </div>

      {/* 发布建议 */}
      <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <TriangleAlert className={cn('h-5 w-5', rec?.cls.includes('red') ? 'text-red-500' : 'text-amber-500')} />
          <div>
            <div className="text-xs text-muted-foreground">发布建议</div>
            <div className="flex items-center gap-2">
              <span className={cn('rounded-md px-2 py-0.5 text-sm font-semibold', rec?.cls)}>{rec?.label ?? '—'}</span>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground md:max-w-xl">{data.summary.note}</p>
      </Card>

      {/* 对比指标卡 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="通过率变化" value={delta(data.passRateDelta)} tone={(data.passRateDelta ?? 0) < 0 ? 'text-red-500' : 'text-emerald-500'} />
        <Metric label="新增失败" value={String(data.newFailCount)} tone={data.newFailCount > 0 ? 'text-red-500' : 'text-foreground'} />
        <Metric label="修复失败" value={String(data.fixedFailCount)} tone="text-emerald-500" />
        <Metric label="稳定性得分" value={data.stabilityScore == null ? '—' : data.stabilityScore.toFixed(2)} />
      </div>

      {/* 差异明细表 */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-1 border-b border-border p-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                filter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">用例</th>
                <th className="px-3 py-2.5 font-medium">风险</th>
                <th className="px-3 py-2.5 font-medium">基线</th>
                <th className="px-3 py-2.5 font-medium">候选</th>
                <th className="px-3 py-2.5 font-medium">变化</th>
                <th className="px-3 py-2.5 font-medium">判定</th>
                <th className="px-3 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <DiffTableRow key={r.caseId} row={r} appCode={data.appCode} />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">该筛选下暂无用例</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 退化类型分布 */}
      {Object.keys(degradation).length > 0 && (
        <Card className="p-4">
          <div className="text-sm font-semibold text-foreground">退化类型分布</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(degradation).map(([type, count]) => (
              <span key={type} className="rounded-lg bg-red-500/10 px-3 py-1.5 text-sm text-red-600 dark:text-red-400">
                {type} · {count}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function DiffTableRow({ row, appCode }: { row: DiffRow; appCode: string }) {
  const change = CHANGE[row.change];
  const verifiable = row.regressionVerdict;
  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-accent/40">
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">{row.caseName}</div>
        <div className="text-xs text-muted-foreground">{row.priority} · {row.caseType === 'MULTI_TURN' ? '多轮' : row.caseType}{row.failureType ? ` · ${row.failureType}` : ''}</div>
      </td>
      <td className="px-3 py-3">
        <Badge variant="outline" className={cn(row.riskLevel === 'HIGH' && 'border-red-400 text-red-500')}>
          {row.riskLevel === 'HIGH' ? '高' : row.riskLevel === 'MEDIUM' ? '中' : '低'}
        </Badge>
      </td>
      <td className="px-3 py-3"><StatusBadge status={row.baselineStatus} /></td>
      <td className="px-3 py-3"><StatusBadge status={row.candidateStatus} /></td>
      <td className="px-3 py-3">
        <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', change.cls)}>{change.label}</span>
      </td>
      <td className="px-3 py-3">
        {verifiable ? (
          <span className={cn('text-xs font-medium', verifiable === 'TRUE_REGRESSION' ? 'text-red-500' : 'text-amber-500')}>
            {verifiable === 'TRUE_REGRESSION' ? '真退化' : '疑似抖动'}
            {row.regressionConfidence != null && <span className="text-muted-foreground"> · {(row.regressionConfidence * 100).toFixed(0)}%</span>}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        {row.candidateResultId && row.change !== 'STABLE_PASS' ? (
          <Link
            href={`/ai-quality-platform/diagnosis/${row.candidateResultId}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            查看诊断 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </td>
    </tr>
  );
}
