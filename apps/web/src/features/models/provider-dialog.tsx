'use client';
/**
 * 供应商对话框 — 新增/编辑供应商
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
import { PROVIDER_TYPE_META } from './model-center-schema';
import type { ProviderFormState, ProviderType } from './types';

interface ProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialForm?: ProviderFormState;
  onSave: (form: ProviderFormState) => Promise<void>;
  title?: string;
}

const DEFAULT_FORM: ProviderFormState = {
  name: '',
  type: 'OPENAI_COMPATIBLE',
  baseUrl: '',
  apiKey: '',
};

export function ProviderDialog({ open, onOpenChange, initialForm, onSave, title = '新增供应商' }: ProviderDialogProps) {
  const [form, setForm] = useState<ProviderFormState>(initialForm ?? DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(initialForm ?? DEFAULT_FORM);
      setError('');
    }
  }, [open, initialForm]);

  const meta = PROVIDER_TYPE_META[form.type];

  const handleSave = async () => {
    if (!form.name.trim()) { setError('请填写供应商名称'); return; }
    if (!form.baseUrl.trim()) { setError('请填写 API 地址'); return; }
    if (!form.apiKey.trim()) { setError('请填写 API Key'); return; }
    setSaving(true);
    try {
      await onSave(form);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>配置 AI 模型供应商的接入信息</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 名称 */}
          <div className="space-y-1.5">
            <Label htmlFor="provider-name">供应商名称 <span className="text-destructive">*</span></Label>
            <Input
              id="provider-name"
              placeholder="如：OpenAI 官方"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          {/* 类型 */}
          <div className="space-y-1.5">
            <Label>供应商类型 <span className="text-destructive">*</span></Label>
            <Select
              value={form.type}
              onValueChange={(v) => {
                const type = v as ProviderType;
                setForm({ ...form, type, baseUrl: PROVIDER_TYPE_META[type].defaultBaseUrl });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(PROVIDER_TYPE_META) as [ProviderType, typeof PROVIDER_TYPE_META[ProviderType]][]).map(
                  ([key, m]) => (
                    <SelectItem key={key} value={key}>{m.label}</SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{meta.configHint}</p>
          </div>

          {/* Base URL */}
          <div className="space-y-1.5">
            <Label htmlFor="provider-url">API 地址 <span className="text-destructive">*</span></Label>
            <Input
              id="provider-url"
              placeholder={meta.defaultBaseUrl}
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            />
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <Label htmlFor="provider-key">API Key <span className="text-destructive">*</span></Label>
            <Input
              id="provider-key"
              type="password"
              placeholder="sk-..."
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>取消</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? '保存中…' : '保存供应商'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
