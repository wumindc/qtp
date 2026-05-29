import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createAnswerProvider, getByPath } from './index';
import { runRegression, evaluateCase, type RunnableCase } from '@ai-quality-platform/eval-engine';

/** 起一个本地 mock AI 服务，真实 socket 验证 adapter。 */
let server: Server;
let base = '';
let lastBodies: any[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = JSON.parse(raw || '{}');
      lastBodies.push({ url: req.url, body });
      if (req.url?.includes('/error')) {
        res.statusCode = 500;
        res.end('boom');
        return;
      }
      res.setHeader('Content-Type', 'application/json');
      if (req.url?.includes('/http-json')) {
        // HTTP JSON 风格
        res.end(JSON.stringify({ data: { answer: `普通回答:${body.query}` } }));
        return;
      }
      // OpenAI 兼容风格：回声「收到几条消息 + 最后一句用户内容」
      const messages = body.messages ?? [];
      const lastUser = [...messages].reverse().find((m: any) => m.role === 'user')?.content ?? '';
      res.end(
        JSON.stringify({ choices: [{ message: { role: 'assistant', content: `[共${messages.length}条] ${lastUser}` } }] }),
      );
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe('getByPath', () => {
  it('支持 dot / 数组索引 / 前导 $.', () => {
    const o = { choices: [{ message: { content: 'hi' } }], data: { answer: 'x' } };
    expect(getByPath(o, 'choices.0.message.content')).toBe('hi');
    expect(getByPath(o, '$.data.answer')).toBe('x');
    expect(getByPath(o, 'data.missing')).toBeUndefined();
  });
});

describe('createAnswerProvider · OpenAI 兼容（真实 HTTP）', () => {
  it('多轮按 messages 累积上下文逐轮调用', async () => {
    const provider = createAnswerProvider({ type: 'openai', baseUrl: base, model: 'demo' });
    const input: RunnableCase = {
      caseId: 1,
      spec: [
        { turnIndex: 1, userInput: '第一句' },
        { turnIndex: 2, userInput: '第二句' },
      ],
    };
    const turns = await provider(input);
    expect(turns).toHaveLength(2);
    // 第 1 轮：只有 1 条 user 消息
    expect(turns[0].answer).toBe('[共1条] 第一句');
    // 第 2 轮：user + assistant + user = 3 条 → 证明上下文被累积携带
    expect(turns[1].answer).toBe('[共3条] 第二句');
    expect(turns[0].status).toBe('success');
    expect(turns[0].latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('与 runRegression + evaluateCase 串起来：断言可判定', async () => {
    const provider = createAnswerProvider({ type: 'openai', baseUrl: base });
    const cases: RunnableCase[] = [
      { caseId: 1, spec: [{ turnIndex: 1, userInput: '你好', expect: { mustContain: ['你好'] } }] },
      { caseId: 2, spec: [{ turnIndex: 1, userInput: 'q', expect: { mustContain: ['不存在的词'] } }] },
    ];
    const results = await runRegression(cases, provider);
    expect(results[0].evaluation.passStatus).toBe('PASS'); // 回声含「你好」
    expect(results[1].evaluation.passStatus).toBe('FAIL');
  });
});

describe('createAnswerProvider · HTTP JSON', () => {
  it('用 bodyTemplate + answerPath 抽取', async () => {
    const provider = createAnswerProvider({
      type: 'http-json',
      baseUrl: base,
      path: '/http-json',
      bodyTemplate: '{"query":"{{query}}"}',
      answerPath: 'data.answer',
    });
    const turns = await provider({ caseId: 1, spec: [{ turnIndex: 1, userInput: '开发票' }] });
    expect(turns[0].answer).toBe('普通回答:开发票');
  });
});

describe('错误处理', () => {
  it('非 2xx → 该轮标记 failed，answer 为空', async () => {
    const provider = createAnswerProvider({ type: 'openai', baseUrl: base, path: '/error' });
    const turns = await provider({ caseId: 1, spec: [{ turnIndex: 1, userInput: 'q' }] });
    expect(turns[0].status).toBe('failed');
    expect(turns[0].answer).toBe('');
  });
});
