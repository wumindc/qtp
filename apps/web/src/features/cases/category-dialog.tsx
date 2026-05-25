'use client';
/**
 * 新增/编辑分类弹窗
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
import { Textarea } from '@/components/ui/textarea';
import type { PresetCategory } from './types';

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 传入时为编辑模式 */
  editingCategory?: PresetCategory;
  onSave: (data: { name: string; description: string }) => Promise<void>;
}

export function CategoryDialog({ open, onOpenChange, editingCategory, onSave }: CategoryDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEditing = Boolean(editingCategory);

  useEffect(() => {
    if (open) {
      setName(editingCategory?.name ?? '');
      setDescription(editingCategory?.description ?? '');
      setError('');
    }
  }, [open, editingCategory]);

  const handleSave = async () => {
    if (!name.trim()) { setError('请填写分类名称'); return; }
    if (!description.trim()) { setError('请填写分类说明'); return; }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim() });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? '编辑分类' : '新增分类'}</DialogTitle>
          <DialogDescription>定义系统预置用例分类，用于全局归档和应用引用</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">分类名称 <span className="text-destructive">*</span></Label>
            <Input
              id="cat-name"
              placeholder="如：安全性测试"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-desc">分类说明 <span className="text-destructive">*</span></Label>
            <Textarea
              id="cat-desc"
              placeholder="描述该分类包含哪类测试用例"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>取消</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? '保存中…' : isEditing ? '更新分类' : '保存分类'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
