'use client';
/**
 * 应用执行计划页
 * @author Antigravity/Gemini-2.5-Pro
 */
import { useRunPlans } from './mock-hooks';
import { Layers3, Plus, Play, Pencil, Trash2, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PopoverConfirm } from '@/components/ui/popover-confirm';

export function AppPlansPage({ appCode }: { appCode: string }) {
  const { plans, deletePlan } = useRunPlans(appCode);

  const handleRun = (planCode: string, planName: string) => {
    toast.success(`已触发执行计划「${planName}」，请在执行历史中查看进度`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Layers3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">执行计划</h1>
            <p className="text-sm text-muted-foreground">共 {plans.length} 个计划</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />新建计划</Button>
      </div>

      <div className="space-y-3">
        {plans.map((plan) => (
          <div key={plan.planCode} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground mb-1">{plan.planName}</h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    用例范围：
                    {plan.caseFilter.type === 'ALL' && '全部用例'}
                    {plan.caseFilter.type === 'BY_RISK' && `高风险 (${plan.caseFilter.risks?.join(', ')})`}
                    {plan.caseFilter.type === 'BY_CATEGORY' && '按分类'}
                    {plan.caseFilter.type === 'MANUAL' && '手动选择'}
                  </span>
                  <span>并发 {plan.concurrency}</span>
                  {plan.evalModelId && (
                    <div className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      <Cpu className="h-3 w-3" />
                      <span>{plan.evalModelName ?? plan.evalModelId}</span>
                    </div>
                  )}
                  {plan.cronExpr && (
                    <Badge variant="outline" className="text-[10px]">定时: {plan.cronExpr}</Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <PopoverConfirm
                  trigger={
                    <Button size="sm" variant="default" className="gap-1.5 h-8">
                      <Play className="h-3.5 w-3.5" />立即执行
                    </Button>
                  }
                  title="立即执行"
                  description={`确定立即触发「${plan.planName}」计划执行？`}
                  onConfirm={() => handleRun(plan.planCode, plan.planName)}
                  confirmLabel="确认执行"
                />
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <Pencil className="h-4 w-4" />
                </Button>
                <PopoverConfirm
                  trigger={
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  }
                  title="删除计划"
                  description={`确定要删除「${plan.planName}」吗？`}
                  onConfirm={() => deletePlan(plan.planCode)}
                />
              </div>
            </div>
          </div>
        ))}

        {plans.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Layers3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无执行计划</p>
          </div>
        )}
      </div>
    </div>
  );
}
