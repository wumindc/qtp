'use client';
/**
 * 应用用例新建弹窗
 * @author codex
 */

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { postGateway } from '@/lib/api/gateway-client';
import { getErrorMessage } from '@/lib/error';
import type { CaseRecord } from './app-cases';

export function CaseFormDialog({
  open,
  onOpenChange,
  appCode,
  categoryId,
  categories,
  editingCase,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  appCode: string;
  categoryId?: string;
  categories: { id: string; name: string }[];
  editingCase?: CaseRecord;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const defaultCategoryId = categoryId || categories[0]?.id || '';
  const [formData, setFormData] = useState({
    categoryId: defaultCategoryId,
    query: '',
    expectedBehavior: '',
  });

  useEffect(() => {
    if (!open) return;
    if (editingCase) {
      setFormData({
        categoryId: editingCase.categoryId,
        query: editingCase.query,
        expectedBehavior: editingCase.expectedBehavior || '',
      });
    } else {
      setFormData({
        categoryId: defaultCategoryId,
        query: '',
        expectedBehavior: '',
      });
    }
  }, [defaultCategoryId, open, editingCase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.categoryId || !formData.query.trim() || !formData.expectedBehavior.trim()) {
      toast.error('请填写完整的必填信息');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        categoryId: formData.categoryId,
        query: formData.query.trim(),
        expectedBehavior: formData.expectedBehavior.trim(),
      };
      if (editingCase) {
        await postGateway('case', '/case/update.do', {
          id: editingCase.id,
          appCode,
          data: payload,
        });
        toast.success('更新用例成功');
      } else {
        await postGateway('case', '/case/create.do', {
          appCode,
          ...payload,
        });
        toast.success('新建用例成功');
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, editingCase ? '更新用例失败' : '新建用例失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingCase ? '编辑应用测试用例' : '新建应用测试用例'}</DialogTitle>
          <DialogDescription>用例只需要维护问题分类、问题内容和期望回答。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="app-case-category">问题分类 <span className="text-red-500">*</span></Label>
            <Select
              value={formData.categoryId}
              onValueChange={(v) => setFormData({ ...formData, categoryId: v })}
            >
              <SelectTrigger id="app-case-category">
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="app-case-query">问题内容 <span className="text-red-500">*</span></Label>
            <Textarea
              id="app-case-query"
              value={formData.query}
              onChange={(e) => setFormData({ ...formData, query: e.target.value })}
              placeholder="请输入要发送给 AI 的问题..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="app-case-expected-behavior">期望回答 <span className="text-red-500">*</span></Label>
            <Textarea
              id="app-case-expected-behavior"
              value={formData.expectedBehavior}
              onChange={(e) => setFormData({ ...formData, expectedBehavior: e.target.value })}
              placeholder="描述大模型应该怎么回答，比如：拒绝回答，提示权限不足..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={loading}>
              {loading ? '保存中...' : (editingCase ? '确认更新' : '确认新建')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
