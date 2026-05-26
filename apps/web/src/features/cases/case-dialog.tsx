'use client';
/**
 * 新增/编辑用例弹窗
 * @author Antigravity/Gemini
 * @author codex
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PresetCase, PresetCategory } from './types';

interface CaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: PresetCategory[];
  /** 传入时为编辑模式，不传为新增模式 */
  editingCase?: PresetCase;
  onSave: (data: Omit<PresetCase, 'id' | 'status'>) => Promise<void>;
}

export function CaseDialog({ open, onOpenChange, categories, editingCase, onSave }: CaseDialogProps) {
  const [categoryId, setCategoryId] = useState('');
  const [input, setInput] = useState('');
  const [expected, setExpected] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 每次打开都重置或用编辑数据填充
  useEffect(() => {
    if (open) {
      setCategoryId(editingCase?.categoryId ?? categories[0]?.id ?? '');
      setInput(editingCase?.input ?? '');
      setExpected(editingCase?.expected ?? '');
      setError('');
    }
  }, [open, editingCase, categories]);

  const isEditing = Boolean(editingCase);

  const handleSave = async () => {
    if (!categoryId) { setError('请选择分类'); return; }
    if (!input.trim()) { setError('请填写问题内容'); return; }
    if (!expected.trim()) { setError('请填写期望回答'); return; }
    setSaving(true);
    try {
      await onSave({ categoryId, input: input.trim(), expected: expected.trim() });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? '编辑预置用例' : '新增预置用例'}</DialogTitle>
          <DialogDescription>维护平台级可复用测试用例，只需要问题分类、问题内容和期望回答。</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>问题分类 <span className="text-destructive">*</span></Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="选择分类" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="case-input">问题内容 <span className="text-destructive">*</span></Label>
            <Textarea id="case-input" placeholder="输入发送给模型的问题" rows={3} value={input} onChange={(e) => setInput(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="case-expected">期望回答 <span className="text-destructive">*</span></Label>
            <Textarea id="case-expected" placeholder="描述模型应该如何回答" rows={3} value={expected} onChange={(e) => setExpected(e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>取消</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? '保存中…' : isEditing ? '更新用例' : '保存用例'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
