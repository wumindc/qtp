'use client';
/**
 * 应用接口配置页 (接入真实网关)
 * @author Antigravity/Gemini-2.5-Pro
 * @author codex
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
import { loadApp, loadAppProtocol, saveAppProtocol } from './api/app-api';
import type { App, AppProtocol } from './types';
import { JSONPath } from 'jsonpath-plus';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buildProtocolTestContext, renderProtocolTemplate } from './protocol-template';

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
      const testContext = buildProtocolTestContext(testQuery);
      let parsedHeaders: Record<string, string> = {};
      try {
        parsedHeaders = JSON.parse(renderProtocolTemplate(protocol.headers || '{}', testContext));
      } catch (e) {
        toast.error('请求头 JSON 格式错误');
        setTesting(false);
        return;
      }

      let parsedBody: any = {};
      try {
        const bodyStr = renderProtocolTemplate(protocol.body || '{}', testContext);
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
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-foreground">请求配置</h2>

          <div className="grid gap-3 md:grid-cols-[7rem_minmax(0,1fr)]">
            <div className="space-y-2">
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
            <div className="min-w-0 space-y-2">
              <Label>接口地址</Label>
              <Input
                value={protocol.url || ''}
                onChange={(e) => setProtocol({ ...protocol, url: e.target.value })}
                className="font-mono text-sm"
                placeholder="http://..."
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[12rem_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label htmlFor="app-concurrency">接口调用并发数</Label>
              <Input
                id="app-concurrency"
                type="number"
                min={1}
                max={10}
                value={protocol.appConcurrency}
                onChange={(e) => setProtocol({
                  ...protocol,
                  appConcurrency: Math.max(1, Math.min(10, Number(e.target.value || 3))),
                })}
              />
            </div>
            <div className="flex items-end text-xs text-muted-foreground pb-2">
              执行计划批量调用被测应用接口时使用，单次发送测试不受影响。
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
              <Badge variant="outline" className="ml-2 text-[10px]">{'{{case.input.query}}'} 用例输入占位符</Badge>
            </Label>
            <Textarea
              value={protocol.body || ''}
              onChange={(e) => setProtocol({ ...protocol, body: e.target.value })}
              className="font-mono text-sm"
              rows={5}
              placeholder={`{\n  "query": "{{case.input.query}}"\n}`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
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

        <div className="bg-card border border-border rounded-xl p-6 space-y-4 self-start">
          <h2 className="text-sm font-semibold text-foreground">接口测试</h2>
          <div className="space-y-2">
            <Label>测试输入</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                placeholder="输入测试 query..."
                className="min-w-0 flex-1"
              />
              <Button
                onClick={handleTest}
                variant={testing ? 'destructive' : 'default'}
                className="gap-2 shrink-0 sm:w-32"
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
    </div>
  );
}
