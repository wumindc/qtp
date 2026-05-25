'use client';

/**
 * 应用创建/编辑弹窗
 * @author Antigravity/Gemini-2.5-Pro
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { App, AppProtocol } from './types';

const DEFAULT_PROTOCOL: AppProtocol = {
  method: 'POST',
  url: '',
  headers: '{\n  "Content-Type": "application/json"\n}',
  body: '{\n  "messages": [{"role": "user", "content": "{{case.query}}"}]\n}',
  answerPath: '$.data.content',
  successExpr: '$.code == 0',
  streamEnabled: false,
};

interface AppFormDialogProps {
  open: boolean;
  editingApp: App | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<App, 'appCode' | 'createdAt' | 'stats'>) => void;
}

export function AppFormDialog({ open, editingApp, onOpenChange, onSubmit }: AppFormDialogProps) {
  const isEdit = !!editingApp;
  const [tab, setTab] = useState('basic');

  /* 表单状态 */
  const [appName, setAppName] = useState('');
  const [appType, setAppType] = useState<'CHAT' | 'WORKFLOW'>('CHAT');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');

  const [method, setMethod] = useState<'GET' | 'POST'>('POST');
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState(DEFAULT_PROTOCOL.headers);
  const [body, setBody] = useState(DEFAULT_PROTOCOL.body);
  const [answerPath, setAnswerPath] = useState(DEFAULT_PROTOCOL.answerPath);
  const [successExpr, setSuccessExpr] = useState(DEFAULT_PROTOCOL.successExpr);

  /* 编辑时回填 */
  useEffect(() => {
    if (open) {
      setTab('basic');
      if (editingApp) {
        setAppName(editingApp.appName);
        setAppType(editingApp.appType);
        setDescription(editingApp.description ?? '');
        setOwner(editingApp.owner);
        setMethod(editingApp.protocol.method);
        setUrl(editingApp.protocol.url);
        setHeaders(editingApp.protocol.headers);
        setBody(editingApp.protocol.body);
        setAnswerPath(editingApp.protocol.answerPath);
        setSuccessExpr(editingApp.protocol.successExpr);
      } else {
        setAppName('');
        setAppType('CHAT');
        setDescription('');
        setOwner('');
        setMethod('POST');
        setUrl('');
        setHeaders(DEFAULT_PROTOCOL.headers);
        setBody(DEFAULT_PROTOCOL.body);
        setAnswerPath(DEFAULT_PROTOCOL.answerPath);
        setSuccessExpr(DEFAULT_PROTOCOL.successExpr);
      }
    }
  }, [open, editingApp]);

  const handleSubmit = () => {
    if (!appName.trim() || !url.trim()) return;
    onSubmit({
      appName: appName.trim(),
      appType,
      description: description.trim(),
      owner: owner.trim(),
      status: editingApp?.status ?? 'ENABLED',
      protocol: { method, url, headers, body, answerPath, successExpr, streamEnabled: false },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑应用' : '新建 AI 应用'}</DialogTitle>
          <DialogDescription>
            {isEdit ? '修改应用的基本信息和接口配置' : '配置需要进行质量评测的业务 AI 接口'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">基本信息</TabsTrigger>
            <TabsTrigger value="protocol">接口配置</TabsTrigger>
          </TabsList>

          {/* ── 基本信息 Tab ── */}
          <TabsContent value="basic" className="space-y-4 pt-4">
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
                    <SelectValue />
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
                rows={2}
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

          </TabsContent>

          {/* ── 接口配置 Tab ── */}
          <TabsContent value="protocol" className="space-y-4 pt-4">
            <div className="flex gap-3">
              <div className="w-28 space-y-2">
                <Label>请求方法</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as 'GET' | 'POST')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="GET">GET</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="url">
                  接口地址 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://api.example.com/v1/chat"
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="headers">
                请求头模板
                <span className="text-muted-foreground text-xs font-normal ml-2">
                  支持 {'{{variable}}'} 变量
                </span>
              </Label>
              <Textarea
                id="headers"
                value={headers}
                onChange={(e) => setHeaders(e.target.value)}
                className="font-mono text-sm"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">
                请求体模板
                <span className="text-muted-foreground text-xs font-normal ml-2">
                  {'{{case.query}}'} 会被用例输入替换
                </span>
              </Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="font-mono text-sm"
                rows={5}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="answerPath">
                  答案路径
                  <span className="text-muted-foreground text-xs font-normal ml-1">JSONPath</span>
                </Label>
                <Input
                  id="answerPath"
                  value={answerPath}
                  onChange={(e) => setAnswerPath(e.target.value)}
                  placeholder="$.data.content"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="successExpr">
                  成功条件
                  <span className="text-muted-foreground text-xs font-normal ml-1">JSONPath</span>
                </Label>
                <Input
                  id="successExpr"
                  value={successExpr}
                  onChange={(e) => setSuccessExpr(e.target.value)}
                  placeholder="$.code == 0"
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!appName.trim() || !url.trim()}>
            {isEdit ? '保存修改' : '创建应用'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
