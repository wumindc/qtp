'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, AlertCircle, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { listResults, type ResultRecord } from './api/plan-execution-api';
import { toast } from 'sonner';

export function AppHistoryDetail({ runCode, onBack }: { runCode: string; onBack: () => void }) {
  const [results, setResults] = useState<ResultRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadResults = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listResults(runCode);
      setResults(data);
    } catch {
      toast.error('加载执行详情失败');
    } finally {
      setLoading(false);
    }
  }, [runCode]);

  useEffect(() => { void loadResults(); }, [loadResults]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PASS': return { label: '通过', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 };
      case 'FAIL': return { label: '失败', color: 'text-red-500 bg-red-500/10 border-red-500/20', icon: XCircle };
      case 'REVIEW': return { label: '待人工确认', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', icon: AlertCircle };
      default: return { label: status, color: 'text-muted-foreground bg-muted border-border', icon: FileJson };
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">执行详情</h1>
          <p className="text-sm text-muted-foreground font-mono mt-0.5">{runCode}</p>
        </div>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto">
        {loading && <div className="text-center py-12 text-muted-foreground">加载中...</div>}
        
        {!loading && results.map((res) => {
          const s = getStatusConfig(res.passStatus);
          const StatusIcon = s.icon;
          return (
            <div key={res.resultId} className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-start justify-between gap-4 border-b pb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <StatusIcon className={cn('h-5 w-5', s.color.split(' ')[0])} />
                    <span className="text-sm font-semibold">{res.caseCode}</span>
                    <Badge variant="outline" className={cn('text-xs px-2 rounded-full border', s.color)}>
                      {s.label}
                    </Badge>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-2xl font-bold font-mono">{res.finalScore}</span>
                  <span className="text-xs text-muted-foreground ml-1">分</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground">大模型实际回答</h4>
                  <div className="bg-muted/30 border rounded-lg p-3 h-48 overflow-y-auto text-sm whitespace-pre-wrap break-all">
                    {res.finalAnswer || <span className="text-muted-foreground/50 italic">无返回内容</span>}
                  </div>
                </div>
                {/* 暂时没有提取 case 信息（如果需要可以再去查 case 列表匹配，这里先占位） */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground">AI 裁判评价理由</h4>
                  <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 h-48 overflow-y-auto text-sm text-foreground/80 whitespace-pre-wrap break-all">
                    {/* 接口暂时未提供，若提供再补上，此处用提示语 */}
                    <span className="text-muted-foreground italic">后端评价理由字段暂未完全返回，得分: {res.finalScore}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && results.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <FileJson className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无明细数据</p>
          </div>
        )}
      </div>
    </div>
  );
}
