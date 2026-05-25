'use client';
/**
 * 应用执行计划页（接入真实后端数据）
 * @author Antigravity/Claude-Sonnet-4.6
 */
import { useState, useEffect, useCallback } from 'react';
import { Layers3, Plus, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PopoverConfirm } from '@/components/ui/popover-confirm';
import { listPlans, deletePlan, startPlan, createPlan, type PlanRecord } from './api/plan-execution-api';
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

import { postGateway } from '@/lib/api/gateway-client';
import { CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/cn';

const planTypeLabels: Record<string, string> = {
  SMOKE: '冒烟测试',
  FULL_REGRESSION: '全量回归',
  HIGH_RISK: '高风险专项',
  CUSTOM: '自定义',
};

interface Category {
  id: string;
  name: string;
}

export function AppPlansPage({ appCode }: { appCode: string }) {
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [form, setForm] = useState<{
    planName: string;
    planType: string;
    scope: 'ALL' | 'CATEGORY';
    selectedCategories: Set<string>;
  }>({
    planName: '',
    planType: 'FULL_REGRESSION',
    scope: 'ALL',
    selectedCategories: new Set(),
  });

  const loadPlansAndCats = useCallback(async () => {
    try {
      setLoading(true);
      const [data, catsRes] = await Promise.all([
        listPlans(appCode),
        postGateway('case', '/case/category/list.do', { page: { currentPage: 1, linesPerPage: 200 }, data: { appCode } })
      ]);
      setPlans(data);
      const catsData = catsRes as { list: Category[] };
      setCategories(catsData?.list || []);
    } catch {
      toast.error('加载列表失败');
    } finally {
      setLoading(false);
    }
  }, [appCode]);

  useEffect(() => { void loadPlansAndCats(); }, [loadPlansAndCats]);

  const handleCreate = async () => {
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
      const planCode = `plan-${appCode}-${Date.now()}`;
      await createPlan({
        planCode,
        planName: form.planName,
        appCode,
        planType: form.planType,
        caseFilter: { 
          categoryCodes: form.scope === 'CATEGORY' ? Array.from(form.selectedCategories) : [], 
          riskLevels: [], 
          selectedCaseCodes: [] 
        },
      });
      toast.success('计划创建成功');
      setDialogOpen(false);
      setForm({ planName: '', planType: 'FULL_REGRESSION', scope: 'ALL', selectedCategories: new Set() });
      await loadPlansAndCats();
    } catch {
      toast.error('创建计划失败');
    } finally {
      setCreating(false);
    }
  };

  const handleRun = async (plan: PlanRecord) => {
    try {
      const run = await startPlan(plan.planCode, plan.appCode);
      toast.success(`执行完成！共 ${run.totalCount} 条用例，通过 ${run.passCount} 条，平均分 ${run.avgScore}`);
      await loadPlansAndCats();
    } catch {
      toast.error('触发执行失败');
    }
  };

  const handleDelete = async (planCode: string) => {
    try {
      await deletePlan(planCode);
      toast.success('计划已删除');
      await loadPlansAndCats();
    } catch {
      toast.error('删除失败');
    }
  };

  const toggleCategory = (id: string) => {
    setForm(prev => {
      const next = new Set(prev.selectedCategories);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, selectedCategories: next };
    });
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
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />新建计划
        </Button>
      </div>

      <div className="space-y-3">
        {loading && (
          <div className="text-center py-12 text-muted-foreground text-sm">加载中...</div>
        )}
        {!loading && plans.map((plan) => (
          <div key={plan.planCode} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground mb-1">{plan.planName}</h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{planTypeLabels[plan.planType] ?? plan.planType}</Badge>
                  <Badge variant={plan.status === 'ENABLED' ? 'default' : 'secondary'}>
                    {plan.status === 'ENABLED' ? '启用' : '禁用'}
                  </Badge>
                  <span className="font-mono text-[10px] opacity-60">{plan.planCode}</span>
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
                  onConfirm={() => handleRun(plan)}
                  confirmLabel="确认执行"
                />
                <PopoverConfirm
                  trigger={
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  }
                  title="删除计划"
                  description={`确定要删除「${plan.planName}」吗？`}
                  onConfirm={() => handleDelete(plan.planCode)}
                />
              </div>
            </div>
          </div>
        ))}

        {!loading && plans.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Layers3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无执行计划</p>
          </div>
        )}
      </div>

      {/* 新建计划弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建执行计划</DialogTitle>
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
              <Label htmlFor="planType">计划类型</Label>
              <Select value={form.planType} onValueChange={(v) => setForm({ ...form, planType: v })}>
                <SelectTrigger id="planType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SMOKE">冒烟测试</SelectItem>
                  <SelectItem value="FULL_REGRESSION">全量回归</SelectItem>
                  <SelectItem value="HIGH_RISK">高风险专项</SelectItem>
                  <SelectItem value="CUSTOM">自定义</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>执行范围</Label>
              <Select value={form.scope} onValueChange={(v: 'ALL' | 'CATEGORY') => setForm({ ...form, scope: v })}>
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
                  <div className="text-xs text-muted-foreground text-center py-2">暂无可用分类</div>
                ) : categories.map(c => {
                  const selected = form.selectedCategories.has(c.id);
                  return (
                    <div 
                      key={c.id} 
                      className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-muted rounded"
                      onClick={() => toggleCategory(c.id)}
                    >
                      <div className="text-primary">
                        {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <span className="text-sm">{c.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? '创建中...' : '确认创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
