'use client';
/**
 * 应用用例管理页 - 占位（待完整实现）
 * @author Antigravity/Gemini-2.5-Pro
 */
import { useAppCases } from './mock-hooks';
import { ClipboardList, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

const riskLabel: Record<string, { label: string; color: string }> = {
  HIGH: { label: '高', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  MEDIUM: { label: '中', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  LOW: { label: '低', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
};

export function AppCasesPage({ appCode }: { appCode: string }) {
  const { cases } = useAppCases(appCode);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">用例管理</h1>
            <p className="text-sm text-muted-foreground">共 {cases.length} 条用例</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">从预置引用</Button>
          <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />新建用例</Button>
        </div>
      </div>

      <div className="space-y-3">
        {cases.map((c) => (
          <div key={c.caseCode} className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-foreground">{c.caseName}</h3>
                  {c.sourcePresetCode && (
                    <Badge variant="outline" className="text-xs">来自预置</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded font-mono truncate">
                  {c.query}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', riskLabel[c.risk]?.color)}>
                  风险 {riskLabel[c.risk]?.label}
                </span>
              </div>
            </div>

            {/* 评估策略 */}
            <div className="flex flex-wrap gap-2">
              {c.assertions.map((a) => (
                <div key={a.id} className="flex items-center gap-1.5 text-xs bg-muted/50 border border-border rounded-lg px-2.5 py-1.5">
                  <span className="font-mono font-semibold text-primary">{a.type}</span>
                  {a.threshold !== undefined && (
                    <span className="text-muted-foreground">≥ {a.threshold}</span>
                  )}
                  {a.evalModelId && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {a.evalModelId}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
