/**
 * @author qtp
 * 真实 AI 应用接入层（轨道 B）。
 * 把被测应用的接口配置变成 eval-engine 的 AnswerProvider：
 * 多轮对话逐轮调用真实 HTTP 端点、抽取 answer，交给引擎评估。
 * 这是「能测真实 AI 应用」承诺的落点；seed 的桩 provider 与此实现同一接口。
 */
import type { AnswerProvider, RunnableCase, TurnActual } from '@ai-quality-platform/eval-engine';

export type AdapterType = 'openai' | 'http-json';

export interface AdapterConfig {
  type: AdapterType;
  baseUrl: string;
  /** OpenAI 兼容：chat/completions 路径；HTTP JSON：请求路径 */
  path?: string;
  apiKey?: string;
  model?: string;
  /** HTTP JSON：请求体模板（支持 {{query}} 占位），字符串化的 JSON */
  bodyTemplate?: string;
  /** HTTP JSON：答案抽取路径，如 "data.answer" 或 "$.choices.0.message.content" */
  answerPath?: string;
  timeoutMs?: number;
  /** 注入自定义 fetch（测试用）；默认用全局 fetch */
  fetchImpl?: typeof fetch;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** 按 dot/索引路径从对象取值，兼容前导 "$." */
export function getByPath(obj: unknown, path: string): unknown {
  const clean = path.replace(/^\$\.?/, '');
  if (!clean) return obj;
  return clean.split('.').reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    if (Array.isArray(acc)) return acc[Number(key)];
    if (typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

const OPENAI_DEFAULT_PATH = '/chat/completions';
const OPENAI_ANSWER_PATH = 'choices.0.message.content';

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

/**
 * 由应用配置生成 AnswerProvider。多轮按 messages 累积上下文逐轮调用。
 */
export function createAnswerProvider(config: AdapterConfig): AnswerProvider {
  const doFetch = config.fetchImpl ?? globalThis.fetch;
  if (!doFetch) throw new Error('当前运行时缺少 fetch，请注入 fetchImpl');

  return async (input: RunnableCase): Promise<TurnActual[]> => {
    const turns = [...input.spec].sort((a, b) => a.turnIndex - b.turnIndex);
    const messages: ChatMessage[] = [];
    const out: TurnActual[] = [];

    for (const turn of turns) {
      const userInput = turn.userInput ?? '';
      messages.push({ role: 'user', content: userInput });
      const startedAt = Date.now();
      let answer = '';
      let status: TurnActual['status'] = 'success';
      try {
        answer = await callOnce(config, doFetch, messages, userInput);
      } catch {
        status = 'failed';
      }
      const latencyMs = Date.now() - startedAt;
      if (status === 'success') messages.push({ role: 'assistant', content: answer });
      out.push({ turnIndex: turn.turnIndex, userInput, answer, latencyMs, status });
    }
    return out;
  };
}

async function callOnce(
  config: AdapterConfig,
  doFetch: typeof fetch,
  messages: ChatMessage[],
  query: string,
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  let url: string;
  let body: string;
  let answerPath: string;

  if (config.type === 'openai') {
    url = joinUrl(config.baseUrl, config.path ?? OPENAI_DEFAULT_PATH);
    body = JSON.stringify({ model: config.model ?? 'gpt-3.5-turbo', messages });
    answerPath = config.answerPath ?? OPENAI_ANSWER_PATH;
  } else {
    url = joinUrl(config.baseUrl, config.path ?? '');
    const template = config.bodyTemplate ?? '{"query":"{{query}}"}';
    body = template
      .replaceAll('{{query}}', escapeJson(query))
      .replaceAll('{{messages}}', () => JSON.stringify(messages));
    answerPath = config.answerPath ?? 'data.answer';
  }

  const ctrl = new AbortController();
  const timer = config.timeoutMs ? setTimeout(() => ctrl.abort(), config.timeoutMs) : null;
  try {
    const resp = await doFetch(url, { method: 'POST', headers, body, signal: ctrl.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    const answer = getByPath(json, answerPath);
    if (typeof answer !== 'string') throw new Error(`answerPath "${answerPath}" 未抽取到字符串`);
    return answer;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function escapeJson(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
