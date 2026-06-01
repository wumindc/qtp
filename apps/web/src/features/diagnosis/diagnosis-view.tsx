'use client';

/**
 * @author qtp
 * 失败诊断屏：多轮逐轮 diff + 失败断言/证据链 + 可能原因 + 修复建议 + 人工复核。
 * 设计依据：docs/20260529-003-失败诊断与执行对比设计规格.md
 */
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, ShieldAlert, Lightbulb, Wrench, FileSearch, CircleCheck, CircleX } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/badge';
import type { DiagnosisView, TurnView, AssertionView } from '@/lib/server/qtp-queries';

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-xl border border-border bg-card', className)}>{children}</div>;
}

const CONF: Record<string, string> = {
  高: 'text-red-500',
  中: 'text-amber-500',
  低: 'text-muted-foreground',
};

/** 渲染带高亮片段的回答文本 */
function HighlightedAnswer({ turn }: { turn: TurnView }) {
  const hs = (turn.highlights ?? []).slice().sort((a, b) => a.start - b.start);
  if (hs.length === 0) return <>{turn.answer}</>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  hs.forEach((h, i) => {
    if (h.start > cursor) parts.push(<span key={`t${i}`}>{turn.answer.slice(cursor, h.start)}</span>);
    const cls = h.kind === 'stale'
      ? 'bg-red-500/20 text-red-600 dark:text-red-400 rounded px-0.5 font-semibold underline decoration-red-400'
      : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded px-0.5 font-semibold';
    parts.push(<mark key={`h${i}`} className={cls}>{turn.answer.slice(h.start, h.end)}</mark>);
    cursor = h.end;
  });
  if (cursor < turn.answer.length) parts.push(<span key="tail">{turn.answer.slice(cursor)}</span>);
  return <>{parts}</>;
}

function TurnBubble({ turn, side, failed }: { turn: TurnView; side: 'baseline' | 'candidate'; failed: boolean }) {
  return (
    <div className={cn('rounded-lg border p-3', failed ? 'border-red-400/60 bg-red-500/5' : 'border-border bg-background')}>
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{side === 'baseline' ? '基线回答' : '候选回答'}</span>
        {turn.latencyMs != null && <span>{turn.latencyMs}ms</span>}
      </div>
      <p className="text-sm leading-relaxed text-foreground">
        <HighlightedAnswer turn={turn} />
      </p>
    </div>
  );
}

export function DiagnosisScreen({ data }: { data: DiagnosisView }) {
  const [diffOnly, setDiffOnly] = useState(false);

  const failedTurnIdx = new Set(data.assertions.filter((a) => !a.passed && a.turnIndex != null).map((a) => a.turnIndex as number));
  const candByTurn = new Map(data.candidateTurns.map((t) => [t.turnIndex, t]));
  const baseByTurn = new Map(data.baselineTurns.map((t) => [t.turnIndex, t]));
  const allTurns = Array.from(new Set([...candByTurn.keys(), ...baseByTurn.keys()])).sort((a, b) => a - b);
  const shownTurns = diffOnly ? allTurns.filter((t) => failedTurnIdx.has(t)) : allTurns;

  const failedAssertions = data.assertions.filter((a) => !a.passed);
  const d = data.diagnosis;
  const showCauses = d && (d.confidence ?? 0) >= 0.5;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* 用例摘要条 */}
      <div>
        <Link href={`/ai-quality-platform/compare/CMP-0001`} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> 返回执行对比
        </Link>
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">{data.caseName}</h1>
            <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border-transparent">新增失败</Badge>
            {data.riskLevel === 'HIGH' && <Badge variant="outline" className="border-red-400 text-red-500">高风险</Badge>}
            {data.regressionVerdict && (
              <span className={cn('text-xs font-medium', data.regressionVerdict === 'TRUE_REGRESSION' ? 'text-red-500' : 'text-amber-500')}>
                {data.regressionVerdict === 'TRUE_REGRESSION' ? '真退化' : '疑似抖动'}
                {data.regressionConfidence != null && ` · 置信度 ${(data.regressionConfidence * 100).toFixed(0)}%`}
                {data.sampleCount != null && ` · 采样 ${data.sampleCount} 次`}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span>基线 {data.baselineVersion}：<span className="text-emerald-600 dark:text-emerald-400">通过</span></span>
            <span>候选 {data.candidateVersion}：<span className="text-red-600 dark:text-red-400">失败</span></span>
            {data.failureType && <span>失败类型：{data.failureType}</span>}
          </div>
          {d?.conclusion && <p className="mt-3 rounded-lg bg-muted/50 p-3 text-sm text-foreground">{d.conclusion}</p>}
        </Card>
      </div>

      {/* 逐轮对比 */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-3">
          <span className="text-sm font-semibold text-foreground">会话逐轮对比</span>
          <div className="flex gap-1">
            <button onClick={() => setDiffOnly(false)} className={cn('rounded-md px-3 py-1 text-xs font-medium', !diffOnly ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}>并排</button>
            <button onClick={() => setDiffOnly(true)} className={cn('rounded-md px-3 py-1 text-xs font-medium', diffOnly ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}>仅看差异</button>
          </div>
        </div>
        <div className="space-y-4 p-4">
          {shownTurns.map((idx) => {
            const cand = candByTurn.get(idx);
            const base = baseByTurn.get(idx);
            const userInput = cand?.userInput ?? base?.userInput ?? '';
            const failed = failedTurnIdx.has(idx);
            return (
              <div key={idx}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">{idx}</span>
                  <span className="text-sm text-foreground">{userInput}</span>
                  {failed && <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border-transparent">断言失败</Badge>}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {base ? <TurnBubble turn={base} side="baseline" failed={false} /> : <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">无基线回答</div>}
                  {cand ? <TurnBubble turn={cand} side="candidate" failed={failed} /> : <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">无候选回答</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 断言与证据 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><ShieldAlert className="h-4 w-4 text-red-500" /> 失败断言</div>
          <div className="space-y-2">
            {failedAssertions.map((a, i) => (
              <AssertionRow key={i} a={a} />
            ))}
            {failedAssertions.length === 0 && <p className="text-sm text-muted-foreground">无失败断言</p>}
          </div>
        </Card>
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><FileSearch className="h-4 w-4 text-primary" /> 证据链</div>
          <ol className="space-y-2">
            {(d?.evidence ?? []).map((e, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">{e.turnIndex}</span>
                <span className="text-foreground">{e.text}</span>
              </li>
            ))}
            {(!d || d.evidence.length === 0) && <p className="text-sm text-muted-foreground">无证据记录</p>}
          </ol>
        </Card>
      </div>

      {/* 可能原因 */}
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><Lightbulb className="h-4 w-4 text-amber-500" /> 可能原因</div>
        {showCauses ? (
          <div className="space-y-2">
            {d!.possibleCauses.map((c, i) => (
              <div key={i} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <div className="text-sm font-medium text-foreground">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.note}</div>
                </div>
                <span className={cn('shrink-0 text-xs font-semibold', CONF[c.confidenceLevel] ?? 'text-muted-foreground')}>{c.confidenceLevel}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">诊断置信度不足，暂不给出推断原因，建议人工复核。</p>
        )}
      </Card>

      {/* 修复建议 */}
      {showCauses && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><Wrench className="h-4 w-4 text-emerald-500" /> 修复建议</div>
          <ul className="space-y-1.5">
            {d!.suggestions.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground"><span className="text-muted-foreground">·</span>{s.text}</li>
            ))}
          </ul>
          {d!.generatedBy && <p className="mt-3 text-xs text-muted-foreground">诊断方式：{d!.generatedBy} · 置信度 {((d!.confidence ?? 0) * 100).toFixed(0)}%</p>}
        </Card>
      )}

      {/* 人工复核 */}
      <ReviewBlock />
    </div>
  );
}

function AssertionRow({ a }: { a: AssertionView }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        {a.passed ? <CircleCheck className="h-4 w-4 text-emerald-500" /> : <CircleX className="h-4 w-4 text-red-500" />}
        <span className="font-mono text-xs text-foreground">{a.assertionType}{a.turnIndex != null ? `（第${a.turnIndex}轮）` : ''}</span>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs">
        <div className="text-muted-foreground">期望：<span className="text-foreground">{fmt(a.expectedValue)}</span></div>
        <div className="text-muted-foreground">实际：<span className="text-red-600 dark:text-red-400">{fmt(a.actualValue)}</span></div>
      </div>
    </div>
  );
}

function fmt(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function ReviewBlock() {
  const [choice, setChoice] = useState<string | null>(null);
  const options = [
    { key: 'CONFIRMED_FAIL', label: '确认失败' },
    { key: 'FALSE_POSITIVE', label: '误报' },
    { key: 'MODEL_CORRECT', label: '模型正确' },
    { key: 'UNCERTAIN', label: '不确定' },
  ];
  return (
    <Card className="p-4">
      <div className="mb-3 text-sm font-semibold text-foreground">人工复核</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => setChoice(o.key)}
            className={cn('rounded-lg border px-3 py-1.5 text-sm transition-colors', choice === o.key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent')}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">复核结论将覆盖自动判定的最终结论，但保留原始评分（提交闭环为后续任务）。</p>
    </Card>
  );
}
