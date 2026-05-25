'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { postGateway } from '@/lib/api/gateway-client';

export function CaseFormDialog({
  open,
  onOpenChange,
  appCode,
  categoryId,
  categories,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  appCode: string;
  categoryId?: string;
  categories: { id: string; name: string }[];
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    caseName: '',
    categoryId: categoryId || (categories.length > 0 ? categories[0].id : ''),
    riskLevel: 'MEDIUM',
    query: '',
    expectedBehavior: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.caseName || !formData.query || !formData.categoryId) {
      toast.error('请填写完整的必填信息');
      return;
    }

    setLoading(true);
    try {
      await postGateway('case', '/case/create.do', {
        ...formData,
        appCode,
      });
      toast.success('新建用例成功');
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || '新建用例失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>新建应用测试用例</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>用例名称 <span className="text-red-500">*</span></Label>
              <Input
                value={formData.caseName}
                onChange={(e) => setFormData({ ...formData, caseName: e.target.value })}
                placeholder="例如：查询不存在的订单"
              />
            </div>
            <div className="space-y-2">
              <Label>所属分类 <span className="text-red-500">*</span></Label>
              <Select
                value={formData.categoryId}
                onValueChange={(v) => setFormData({ ...formData, categoryId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>风险等级</Label>
            <Select
              value={formData.riskLevel}
              onValueChange={(v) => setFormData({ ...formData, riskLevel: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HIGH">高</SelectItem>
                <SelectItem value="MEDIUM">中</SelectItem>
                <SelectItem value="LOW">低</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>测试输入 (Query) <span className="text-red-500">*</span></Label>
            <Textarea
              value={formData.query}
              onChange={(e) => setFormData({ ...formData, query: e.target.value })}
              placeholder="请输入测试给 AI 的问题..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>期望行为 <span className="text-red-500">*</span></Label>
            <Textarea
              value={formData.expectedBehavior}
              onChange={(e) => setFormData({ ...formData, expectedBehavior: e.target.value })}
              placeholder="描述大模型应该怎么回答，比如：拒绝回答，提示权限不足..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={loading}>
              {loading ? '保存中...' : '确认新建'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
