'use client';
/**
 * 应用评估配置页
 * @author codex
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrainCircuit, Save, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  loadEvaluationConfig,
  loadEvaluationModels,
  saveEvaluationConfig,
  type AppEvaluationConfig,
  type EvaluationModelOption,
} from './api/app-evaluation-api';

function normalizeEvaluationConcurrency(value: string) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) return 1;
  return Math.max(1, Math.min(10, nextValue));
}

export function AppEvaluationPage({ appCode }: { appCode: string }) {
  const [config, setConfig] = useState<AppEvaluationConfig | null>(null);
  const [models, setModels] = useState<EvaluationModelOption[]>([]);
  const [modelId, setModelId] = useState('');
  const [promptOverrideEnabled, setPromptOverrideEnabled] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [evaluationConcurrency, setEvaluationConcurrency] = useState(3);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const [configData, modelData] = await Promise.all([
        loadEvaluationConfig(appCode),
        loadEvaluationModels(),
      ]);
      setConfig(configData);
      setModels(modelData);
      setModelId(configData.modelId);
      setPromptOverrideEnabled(configData.promptOverrideEnabled);
      setCustomPrompt(configData.customPrompt);
      setEvaluationConcurrency(configData.evaluationConcurrency);
    } catch {
      toast.error('加载评估配置失败');
    } finally {
      setLoading(false);
    }
  }, [appCode]);

  useEffect(() => { void refresh(); }, [refresh]);

  const selectedModel = useMemo(() => models.find((model) => model.id === modelId), [modelId, models]);
  const effectivePrompt = promptOverrideEnabled && customPrompt.trim() ? customPrompt : config?.systemPrompt ?? '';

  const handleSave = async () => {
    if (!modelId) {
      toast.error('请先选择评估模型');
      return;
    }
    if (promptOverrideEnabled && !customPrompt.trim()) {
      toast.error('请填写覆盖提示词');
      return;
    }
    try {
      setSaving(true);
      const saved = await saveEvaluationConfig(appCode, {
        modelId,
        promptOverrideEnabled,
        customPrompt: customPrompt.trim(),
        evaluationConcurrency,
      });
      setConfig(saved);
      setPromptOverrideEnabled(saved.promptOverrideEnabled);
      setCustomPrompt(saved.customPrompt);
      setEvaluationConcurrency(saved.evaluationConcurrency);
      toast.success('评估配置已保存');
    } catch {
      toast.error('保存评估配置失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-muted-foreground">加载中...</div>;
  if (!config) return <div className="text-muted-foreground">评估配置加载失败</div>;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <BrainCircuit className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">评估配置</h1>
            <p className="text-sm text-muted-foreground">配置每条用例结果的评估模型和裁判提示词</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          保存评估配置
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(420px,1.15fr)]">
        <section className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">评估模型</h2>
              <p className="text-xs text-muted-foreground mt-1">执行计划启动前会校验模型和供应商是否可用</p>
            </div>
            <Badge variant={config.configured ? 'default' : 'outline'}>
              {config.configured ? '已配置' : '未配置'}
            </Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="judge-model">评估模型</Label>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger id="judge-model" aria-label="评估模型" className="w-full">
                <SelectValue placeholder="请选择评估模型" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedModel ? (
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                {selectedModel.name}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {selectedModel.providerName} · {selectedModel.modelId}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              {models.length === 0
                ? '暂无可用 LLM 评估模型，请先到模型中心启用模型。'
                : '请选择一个 LLM 评估模型，保存后执行计划才会启动评估。'}
            </div>
          )}

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-muted-foreground">
            没有保存评估模型、模型停用或供应商停用时，执行计划不会启动；若执行过程中评估调用失败，只标记当前用例失败。
          </div>

          <div className="space-y-2">
            <Label htmlFor="evaluation-concurrency">评估调用并发数</Label>
            <Input
              id="evaluation-concurrency"
              type="number"
              min={1}
              max={10}
              value={evaluationConcurrency}
              onChange={(event) => setEvaluationConcurrency(normalizeEvaluationConcurrency(event.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              接口阶段全部结束后，评估阶段按该并发数调用裁判模型。
            </p>
          </div>
        </section>

        <section className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">裁判提示词</h2>
              <p className="text-xs text-muted-foreground mt-1">默认使用系统预置提示词，也可以为当前应用覆盖</p>
            </div>
            <Button
              type="button"
              variant={promptOverrideEnabled ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPromptOverrideEnabled((value) => !value)}
              className="gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {promptOverrideEnabled ? '关闭覆盖提示词' : '启用覆盖提示词'}
            </Button>
          </div>

          <div className="space-y-2">
            <Label>系统默认提示词</Label>
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-foreground/90 whitespace-pre-wrap">
              {config.systemPrompt}
            </div>
          </div>

          {promptOverrideEnabled && (
            <div className="space-y-2">
              <Label htmlFor="custom-prompt">覆盖提示词</Label>
              <Textarea
                id="custom-prompt"
                aria-label="覆盖提示词"
                value={customPrompt}
                onChange={(event) => setCustomPrompt(event.target.value)}
                className="min-h-40 font-mono text-sm"
                placeholder="为当前应用编写专属评估提示词"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>当前生效提示词</Label>
            <div className="rounded-lg border border-primary/10 bg-primary/5 p-4 text-sm text-foreground/90 whitespace-pre-wrap">
              {effectivePrompt || '暂无生效提示词'}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
