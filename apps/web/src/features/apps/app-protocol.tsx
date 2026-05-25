'use client';
/**
 * 应用接口配置页 (接入真实网关)
 * @author Antigravity/Gemini-2.5-Pro
 */
import { useState, useEffect, useRef, useCallback } from 'react';
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
import { KeyRound, Send, CheckCircle2, XCircle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { loadApp, loadAppProtocol, saveAppProtocol, saveApp } from './api/app-api';
import type { App, AppProtocol } from './types';
import { JSONPath } from 'jsonpath-plus';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const AVAILABLE_MODELS = [
  { id: 'qwen-max-model', name: 'Qwen-Max (千问-Max)', provider: '阿里云' },
  { id: 'qwen-plus-model', name: 'Qwen-Plus (千问-Plus)', provider: '阿里云' },
  { id: 'qwen-turbo-model', name: 'Qwen-Turbo (千问-Turbo)', provider: '阿里云' },
  { id: 'gpt4o-model', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gpt35-model', name: 'GPT-3.5-Turbo', provider: 'OpenAI' },
];

export function AppProtocolPage({ appCode }: { appCode: string }) {
  const [app, setApp] = useState<App | null>(null);
  const [protocol, setProtocol] = useState<AppProtocol | null>(null);
  const [loading, setLoading] = useState(true);

  const [testQuery, setTestQuery] = useState('什么是信用黑名单');
  const [testResult, setTestResult] = useState<{ success: boolean; response: string; extracted?: string; latency: number } | null>(null);
  const [testing, setTesting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [appData, protocolData] = await Promise.all([
        loadApp(appCode),
        loadAppProtocol(appCode),
      ]);
      setApp(appData);
      setProtocol(protocolData);
    } catch {
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [appCode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) return <div className="text-muted-foreground">加载中...</div>;
  if (!app || !protocol) return <div className="text-muted-foreground">应用不存在</div>;

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      await saveAppProtocol(appCode, protocol);
      if (app.defaultEvalModelId !== undefined) {
        await saveApp(app, appCode);
      }
      toast.success('配置已保存');
    } catch {
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (testing) {
      abortControllerRef.current?.abort();
      setTesting(false);
      return;
    }

    setTesting(true);
    setTestResult({ success: true, response: '', latency: 0 });
    const startTime = Date.now();
    abortControllerRef.current = new AbortController();

    try {
      let parsedHeaders: Record<string, string> = {};
      try {
        parsedHeaders = JSON.parse(protocol.headers || '{}');
      } catch (e) {
        toast.error('请求头 JSON 格式错误');
        setTesting(false);
        return;
      }

      let parsedBody: any = {};
      try {
        const bodyStr = protocol.body.replace(/\{\{\s*case\.query\s*\}\}/g, testQuery);
        parsedBody = JSON.parse(bodyStr || '{}');
      } catch (e) {
        toast.error('请求体 JSON 格式错误');
        setTesting(false);
        return;
      }

      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: protocol.url,
          method: protocol.method,
          headers: parsedHeaders,
          body: parsedBody,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        setTestResult({ success: false, response: `HTTP ${res.status}: ${errorText}`, latency: Date.now() - startTime });
        setTesting(false);
        return;
      }

      const contentType = res.headers.get('Content-Type') || '';
      if (contentType.includes('text/event-stream')) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        let fullExtracted = '';
        let buffer = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            fullResponse += chunk;
            buffer += chunk;
            
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data:')) {
                const dataStr = line.substring(5).trim();
                if (dataStr === '[DONE]') continue;
                try {
                  const jsonObj = JSON.parse(dataStr);
                  if (protocol.answerPath) {
                    let extractedValue: any = undefined;
                    try {
                      // 尝试使用 jsonpath-plus
                      const result = typeof JSONPath === 'function' ? JSONPath({ path: protocol.answerPath, json: jsonObj }) : undefined;
                      if (result && result.length > 0) {
                        extractedValue = result[0];
                      }
                    } catch (e) {
                      console.error('JSONPath error:', e);
                    }

                    // 降级处理：如果 jsonpath 失败或不可用，执行简单路径提取
                    if (extractedValue === undefined) {
                      try {
                        let current = jsonObj;
                        const parts = protocol.answerPath.replace(/^\$\./, '').split(/[.\[\]]+/).filter(Boolean);
                        for (const part of parts) {
                          if (current == null) break;
                          current = current[part];
                        }
                        if (current !== undefined && current !== jsonObj) {
                          extractedValue = current;
                        }
                      } catch (err) {}
                    }

                    if (extractedValue != null) {
                      fullExtracted += typeof extractedValue === 'string' ? extractedValue : JSON.stringify(extractedValue);
                    }
                  }
                } catch (e) {
                  console.error('Failed to parse or extract:', dataStr, e);
                }
              }
            }
            setTestResult({ success: true, response: fullResponse, extracted: fullExtracted, latency: Date.now() - startTime });
          }
        }
      } else {
        const text = await res.text();
        let extracted = text;
        try {
          const jsonObj = JSON.parse(text);
          if (protocol.answerPath) {
            const result = JSONPath({ path: protocol.answerPath, json: jsonObj });
            if (result && result.length > 0 && result[0] != null) {
              extracted = typeof result[0] === 'string' ? result[0] : JSON.stringify(result[0]);
            }
          }
        } catch (e) {}
        setTestResult({ success: true, response: text, extracted, latency: Date.now() - startTime });
      }

      toast.success('请求完成');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast.info('测试已取消');
      } else {
        setTestResult({ success: false, response: `请求异常: ${error.message}`, latency: Date.now() - startTime });
        toast.error('请求异常');
      }
    } finally {
      setTesting(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">接口配置</h1>
            <p className="text-sm text-muted-foreground">配置 AI 应用的 HTTP 接口协议</p>
          </div>
        </div>
        <Button onClick={handleSaveConfig} disabled={isSaving} className="gap-2">
          <Save className="h-4 w-4" />
          保存配置
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-foreground">请求配置</h2>

        <div className="flex gap-3">
          <div className="w-28 space-y-2">
            <Label>请求方法</Label>
            <Select
              value={protocol.method}
              onValueChange={(v: 'GET' | 'POST') => setProtocol({ ...protocol, method: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-2">
            <Label>接口地址</Label>
            <Input
              value={protocol.url || ''}
              onChange={(e) => setProtocol({ ...protocol, url: e.target.value })}
              className="font-mono text-sm"
              placeholder="http://..."
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>
            请求头配置 (JSON 格式)
            <Badge variant="outline" className="ml-2 text-[10px]">可选</Badge>
          </Label>
          <Textarea
            value={protocol.headers || ''}
            onChange={(e) => setProtocol({ ...protocol, headers: e.target.value })}
            className="font-mono text-sm"
            rows={4}
            placeholder={`{\n  "Authorization": "Bearer ..."\n}`}
          />
        </div>

        <div className="space-y-2">
          <Label>
            请求体模板 (JSON 格式)
            <Badge variant="outline" className="ml-2 text-[10px]">{'{{case.query}}'} 用例输入占位符</Badge>
          </Label>
          <Textarea
            value={protocol.body || ''}
            onChange={(e) => setProtocol({ ...protocol, body: e.target.value })}
            className="font-mono text-sm"
            rows={5}
            placeholder={`{\n  "query": "{{case.query}}"\n}`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>答案提取路径 <span className="text-xs text-muted-foreground">JSONPath</span></Label>
            <Input
              value={protocol.answerPath || ''}
              onChange={(e) => setProtocol({ ...protocol, answerPath: e.target.value })}
              className="font-mono text-sm"
              placeholder="$.choices[0].message.content"
            />
          </div>
          <div className="space-y-2">
            <Label>调用成功条件 <span className="text-xs text-muted-foreground">表达式</span></Label>
            <Input
              value={protocol.successExpr || ''}
              onChange={(e) => setProtocol({ ...protocol, successExpr: e.target.value })}
              className="font-mono text-sm"
              placeholder="$.code == 200"
            />
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">评估模型配置</h2>
        <div className="space-y-2">
          <Label>默认评估模型</Label>
          <Select
            value={app.defaultEvalModelId || ''}
            onValueChange={(v) => setApp({ ...app, defaultEvalModelId: v })}
          >
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
            <Button
              onClick={handleTest}
              variant={testing ? 'destructive' : 'default'}
              className="gap-2 shrink-0 w-32"
            >
              {testing ? <XCircle className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {testing ? '停止接收' : '发送测试'}
            </Button>
          </div>
        </div>

        {testResult && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
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
            
            <Tabs defaultValue="extracted" className="w-full">
              <TabsList className="grid w-full grid-cols-2 max-w-[300px]">
                <TabsTrigger value="extracted">提取文本</TabsTrigger>
                <TabsTrigger value="raw">原始报文</TabsTrigger>
              </TabsList>
              <TabsContent value="extracted">
                <pre className="text-xs text-foreground bg-background p-3 rounded border overflow-x-auto whitespace-pre-wrap break-all min-h-[100px]">
                  {testResult.extracted ? (
                    testResult.extracted
                  ) : testing ? (
                    <span className="text-muted-foreground italic">（正在接收并提取内容...）</span>
                  ) : (
                    <span className="text-muted-foreground italic">（未提取到内容，请检查答案路径）</span>
                  )}
                  {testing && <span className="animate-pulse ml-1">▍</span>}
                </pre>
              </TabsContent>
              <TabsContent value="raw">
                <pre className="text-xs text-muted-foreground bg-background p-3 rounded border overflow-x-auto whitespace-pre-wrap break-all min-h-[100px] max-h-[400px]">
                  {testResult.response}
                  {testing && <span className="animate-pulse ml-1">▍</span>}
                </pre>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
