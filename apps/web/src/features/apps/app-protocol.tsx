/**
 * 应用接口配置页
 * @author Antigravity/Gemini-2.5-Pro
 */
'use client';

import { useState } from 'react';
import { useApp } from './mock-hooks';
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
import { Badge } from '@/components/ui/badge';
import { KeyRound, Send, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const AVAILABLE_MODELS = [
  { id: 'qwen-max-model', name: 'Qwen-Max', provider: '阿里云' },
  { id: 'qwen-turbo-model', name: 'Qwen-Turbo', provider: '阿里云' },
  { id: 'gpt4o-model', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gpt35-model', name: 'GPT-3.5-Turbo', provider: 'OpenAI' },
];

export function AppProtocolPage({ appCode }: { appCode: string }) {
  const { app } = useApp(appCode);
  const [testQuery, setTestQuery] = useState('你好，请问有什么可以帮你？');
  const [testResult, setTestResult] = useState<{ success: boolean; response: string; latency: number } | null>(null);
  const [testing, setTesting] = useState(false);

  if (!app) return <div className="text-muted-foreground">应用不存在</div>;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    // 模拟测试请求
    await new Promise((r) => setTimeout(r, 1200));
    setTestResult({
      success: true,
      response: '{"code":0,"data":{"content":"您好！我是智能助手，很高兴为您服务。请问有什么我可以帮助您的？"}}',
      latency: 1180,
    });
    setTesting(false);
    toast.success('测试请求发送成功');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <KeyRound className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">接口配置</h1>
          <p className="text-sm text-muted-foreground">配置 AI 应用的 HTTP 接口协议</p>
        </div>
      </div>

      {/* 基础接口 */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-foreground">请求配置</h2>

        <div className="flex gap-3">
          <div className="w-28 space-y-2">
            <Label>请求方法</Label>
            <Select defaultValue={app.protocol.method} disabled>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-2">
            <Label>接口地址</Label>
            <Input defaultValue={app.protocol.url} className="font-mono text-sm" readOnly />
          </div>
        </div>

        <div className="space-y-2">
          <Label>
            请求头模板
            <Badge variant="outline" className="ml-2 text-[10px]">{'{{variable}}'} 支持变量</Badge>
          </Label>
          <Textarea defaultValue={app.protocol.headers} className="font-mono text-sm" rows={4} readOnly />
        </div>

        <div className="space-y-2">
          <Label>
            请求体模板
            <Badge variant="outline" className="ml-2 text-[10px]">{'{{case.query}}'} 用例输入占位符</Badge>
          </Label>
          <Textarea defaultValue={app.protocol.body} className="font-mono text-sm" rows={5} readOnly />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>答案路径 <span className="text-xs text-muted-foreground">JSONPath</span></Label>
            <Input defaultValue={app.protocol.answerPath} className="font-mono text-sm" readOnly />
          </div>
          <div className="space-y-2">
            <Label>成功条件 <span className="text-xs text-muted-foreground">JSONPath</span></Label>
            <Input defaultValue={app.protocol.successExpr} className="font-mono text-sm" readOnly />
          </div>
        </div>
      </div>

      {/* 评估模型 */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">评估模型配置</h2>
        <div className="space-y-2">
          <Label>默认评估模型</Label>
          <Select defaultValue={app.defaultEvalModelId ?? ''} disabled>
            <SelectTrigger>
              <SelectValue placeholder="未配置" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                  <span className="text-muted-foreground ml-2 text-xs">({m.provider})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            用于 AI 裁判评估（LLM-as-Judge）。执行计划或单条策略可覆盖此配置。
          </p>
        </div>
      </div>

      {/* 接口测试 */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">接口测试</h2>
        <div className="space-y-2">
          <Label>测试输入</Label>
          <div className="flex gap-2">
            <Input
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              placeholder="输入测试 query..."
              className="flex-1"
            />
            <Button onClick={handleTest} disabled={testing} className="gap-2 shrink-0">
              <Send className="h-4 w-4" />
              {testing ? '发送中…' : '发送测试'}
            </Button>
          </div>
        </div>

        {testResult && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm font-medium">
                {testResult.success ? '请求成功' : '请求失败'}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">{testResult.latency}ms</span>
            </div>
            <pre className="text-xs text-foreground bg-background p-3 rounded border overflow-x-auto whitespace-pre-wrap break-all">
              {testResult.response}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
