'use client';
/**
 * 模型对话框 — 新增/编辑模型
 * @author Antigravity/Gemini
 */
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import {
  PROVIDER_TYPE_META,
  MODEL_TYPE_META,
  buildModelForm,
  SUPPORT_OPTIONS,
} from './model-center-schema';
import type { ModelFormState, ModelProviderRecord, ModelType } from './types';

interface ModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: ModelProviderRecord[];
  initialForm?: ModelFormState;
  onSave: (form: ModelFormState, provider: ModelProviderRecord) => Promise<void>;
  title?: string;
}

export function ModelDialog({ open, onOpenChange, providers, initialForm, onSave, title = '新增模型' }: ModelDialogProps) {
  const [form, setForm] = useState<ModelFormState>(
    initialForm ?? buildModelForm(providers[0]?.code, providers[0]?.type, 'LLM'),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(initialForm ?? buildModelForm(providers[0]?.code, providers[0]?.type, 'LLM'));
      setError('');
    }
  }, [open, initialForm, providers]);

  const selectedProvider = providers.find((p) => p.code === form.provider) ?? providers[0];
  const isEmbedding = form.modelType === 'EMBEDDING';

  const handleSave = async () => {
    if (!form.name.trim()) { setError('请填写模型名称'); return; }
    if (!form.modelId.trim()) { setError('请填写 Model ID'); return; }
    if (!selectedProvider) { setError('请选择供应商'); return; }
    setSaving(true);
    try {
      await onSave(form, selectedProvider);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>配置 AI 模型接入参数，支持 LLM 和 Embedding 两种类型</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 名称 */}
          <div className="space-y-1.5">
            <Label htmlFor="model-name">模型名称 <span className="text-destructive">*</span></Label>
            <Input id="model-name" placeholder="如：GPT-4.1 Mini" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          {/* 供应商 */}
          <div className="space-y-1.5">
            <Label>供应商 <span className="text-destructive">*</span></Label>
            <Select
              value={form.provider}
              onValueChange={(v) => {
                const p = providers.find((x) => x.code === v);
                setForm(buildModelForm(v, p?.type, form.modelType as ModelType));
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择供应商" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.code} value={p.code}>
                    {p.name} ({PROVIDER_TYPE_META[p.type].label})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 模型类型 */}
          <div className="space-y-1.5">
            <Label>模型类型</Label>
            <Select
              value={form.modelType}
              onValueChange={(v) => {
                const mt = v as ModelType;
                const meta = PROVIDER_TYPE_META[selectedProvider?.type ?? 'OPENAI_COMPATIBLE'];
                setForm({
                  ...form,
                  modelType: mt,
                  modelId: mt === 'EMBEDDING' ? (meta.embeddingExample ?? '') : meta.llmExample,
                  dimensions: mt === 'EMBEDDING' ? '1024' : '',
                });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(MODEL_TYPE_META) as [ModelType, typeof MODEL_TYPE_META[ModelType]][]).map(([key, m]) => (
                  <SelectItem key={key} value={key}>{m.label} — {m.description}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model ID */}
          <div className="space-y-1.5">
            <Label htmlFor="model-id">Model ID <span className="text-destructive">*</span></Label>
            <Input id="model-id" placeholder="如 gpt-4o" value={form.modelId} onChange={(e) => setForm({ ...form, modelId: e.target.value })} />
          </div>

          {/* LLM 专属参数 */}
          {!isEmbedding && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>上下文窗口</Label>
                <Input placeholder="128k" value={form.contextWindow} onChange={(e) => setForm({ ...form, contextWindow: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>最大输出 Token</Label>
                <Input placeholder="4096" value={form.maxOutputTokens} onChange={(e) => setForm({ ...form, maxOutputTokens: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>流式输出</Label>
                <Select value={form.stream} onValueChange={(v) => setForm({ ...form, stream: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{SUPPORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>JSON Mode</Label>
                <Select value={form.jsonMode} onValueChange={(v) => setForm({ ...form, jsonMode: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{SUPPORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>工具调用</Label>
                <Select value={form.toolCalling} onValueChange={(v) => setForm({ ...form, toolCalling: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{SUPPORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>思考模式</Label>
                <Select value={form.thinkingEnabled} onValueChange={(v) => setForm({ ...form, thinkingEnabled: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{SUPPORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Embedding 专属参数 */}
          {isEmbedding && (
            <div className="space-y-1.5">
              <Label>向量维度</Label>
              <Input placeholder="1024" value={form.dimensions} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>取消</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? '保存中…' : '保存模型'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
