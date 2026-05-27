'use client';

/**
 * 应用创建/编辑弹窗
 * 只包含基本信息，接口配置在应用内"接口配置"页单独管理
 * @author Antigravity/Claude-Sonnet-4.6
 */

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { App } from './types';

interface AppFormDialogProps {
  open: boolean;
  editingApp: App | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<App, 'appCode' | 'createdAt' | 'stats'>) => void;
}

export function AppFormDialog({ open, editingApp, onOpenChange, onSubmit }: AppFormDialogProps) {
  const isEdit = !!editingApp;

  /* 表单状态 */
  const [appName, setAppName] = useState('');
  const [appType, setAppType] = useState<'CHAT' | 'WORKFLOW'>('CHAT');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');

  /* 编辑时回填 */
  useEffect(() => {
    if (open) {
      if (editingApp) {
        setAppName(editingApp.appName);
        setAppType(editingApp.appType);
        setDescription(editingApp.description ?? '');
        setOwner(editingApp.owner);
      } else {
        setAppName('');
        setAppType('CHAT');
        setDescription('');
        setOwner('');
      }
    }
  }, [open, editingApp]);

  const handleSubmit = () => {
    if (!appName.trim()) return;
    onSubmit({
      appName: appName.trim(),
      appType,
      description: description.trim(),
      owner: owner.trim(),
      status: editingApp?.status ?? 'ENABLED',
      // 接口配置由独立的接口配置页管理，这里传入编辑前的值或默认值
      protocol: editingApp?.protocol ?? {
        method: 'POST',
        url: '',
        headers: '{\n  "Content-Type": "application/json"\n}',
        body: '{\n  "messages": [{"role": "user", "content": "{{case.query}}"}]\n}',
        answerPath: '$.content',
        successExpr: '$.code == 0',
        streamEnabled: false,
        appConcurrency: 3,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑应用' : '新建 AI 应用'}</DialogTitle>
          <DialogDescription>
            {isEdit ? '修改应用的基本信息' : '填写应用基本信息，接口配置可在应用详情页单独设置'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appName">
                应用名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="appName"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="如：智能客服助手"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appType">应用类型</Label>
              <Select value={appType} onValueChange={(v) => setAppType(v as 'CHAT' | 'WORKFLOW')}>
                <SelectTrigger id="appType">
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHAT">CHAT - 对话问答</SelectItem>
                  <SelectItem value="WORKFLOW" disabled>WORKFLOW - 工作流（待开发）</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">应用描述</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要描述该应用的功能和用途..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner">负责人</Label>
            <Input
              id="owner"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="如：张三"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!appName.trim()}>
            {isEdit ? '保存修改' : '创建应用'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
