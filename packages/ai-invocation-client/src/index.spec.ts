import { describe, expect, it, vi } from 'vitest';
import { AiInvocationClient, toInvocationAuditJson } from './index';

describe('AiInvocationClient', () => {
  it('posts chat invocations to the internal AI invocation service', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      data: {
        status: 'SUCCEEDED',
        content: 'pong',
        responseJson: { choices: [{ message: { content: 'pong' } }] },
        elapsedMs: 12,
      },
    }), { status: 200 }));
    const client = new AiInvocationClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await client.invokeChat({
      connection: {
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiKey: 'sk-test',
      },
      request: {
        traceId: 'trace-chat',
        providerCode: 'qwen-main',
        modelId: 'qwen-plus',
        protocol: 'QWEN_COMPATIBLE',
        messages: [{ role: 'user', content: 'ping' }],
        enableThinking: false,
      },
    });

    expect(result).toMatchObject({ status: 'SUCCEEDED', content: 'pong' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:3105/ai-quality-platform/model/chat/invoke.do',
      expect.objectContaining({ method: 'POST' }),
    );
    const firstCall = fetchImpl.mock.calls[0] as unknown as [unknown, RequestInit];
    const body = JSON.parse(String(firstCall[1].body));
    expect(body).toMatchObject({
      connection: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKey: 'sk-test' },
      request: { modelId: 'qwen-plus', enableThinking: false },
    });
  });

  it('posts embedding invocations to the internal AI invocation service', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      data: {
        status: 'SUCCEEDED',
        responseJson: { data: [{ embedding: [0.1, 0.2] }] },
        elapsedMs: 8,
      },
    }), { status: 200 }));
    const client = new AiInvocationClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await client.invokeEmbedding({
      connection: {
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'sk-test',
      },
      request: {
        traceId: 'trace-embedding',
        providerCode: 'openai-compatible-main',
        modelId: 'text-embedding-3-large',
        protocol: 'OPENAI_EMBEDDINGS',
        input: 'ping',
        dimensions: 1024,
      },
    });

    expect(result.status).toBe('SUCCEEDED');
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:3105/ai-quality-platform/model/embedding/invoke.do',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('posts provider model discovery to the internal AI invocation service', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      data: {
        status: 'SUCCEEDED',
        responseJson: { data: [{ id: 'qwen-plus' }] },
        elapsedMs: 6,
      },
    }), { status: 200 }));
    const client = new AiInvocationClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await client.listModels({
      connection: {
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiKey: 'sk-test',
      },
      request: {
        traceId: 'trace-models',
        providerCode: 'qwen-main',
      },
    });

    expect(result).toMatchObject({ status: 'SUCCEEDED', responseJson: { data: [{ id: 'qwen-plus' }] } });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:3105/ai-quality-platform/model/models/list.do',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('reports malformed successful AI invocation service responses as failures', async () => {
    const fetchImpl = vi.fn(async () => new Response('not-json', { status: 200 }));
    const client = new AiInvocationClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const chatResult = await client.invokeChat({
      connection: { baseUrl: 'https://api.example.com/v1', apiKey: 'sk-test' },
      request: {
        traceId: 'trace-bad-chat',
        providerCode: 'openai-compatible-main',
        modelId: 'gpt-test',
        protocol: 'OPENAI_COMPATIBLE',
        messages: [{ role: 'user', content: 'ping' }],
      },
    });
    const embeddingResult = await client.invokeEmbedding({
      connection: { baseUrl: 'https://api.example.com/v1', apiKey: 'sk-test' },
      request: {
        traceId: 'trace-bad-embedding',
        providerCode: 'openai-compatible-main',
        modelId: 'text-embedding-test',
        protocol: 'OPENAI_EMBEDDINGS',
        input: 'ping',
      },
    });
    const modelsResult = await client.listModels({
      connection: { baseUrl: 'https://api.example.com/v1', apiKey: 'sk-test' },
      request: {
        traceId: 'trace-bad-models',
        providerCode: 'openai-compatible-main',
      },
    });

    for (const result of [chatResult, embeddingResult, modelsResult]) {
      expect(result).toMatchObject({
        status: 'FAILED',
        errorCode: 'AI_INVOCATION_SERVICE_BAD_RESPONSE',
      });
    }
  });

  it('serializes the internal invocation request shape for audit records', () => {
    const auditJson = toInvocationAuditJson({
      traceId: 'trace-audit',
      providerCode: 'qwen-main',
      modelId: 'qwen-plus',
      protocol: 'QWEN_COMPATIBLE',
      messages: [{ role: 'user', content: 'ping' }],
      enableThinking: false,
      temperature: undefined,
    });

    expect(auditJson).toMatchObject({
      traceId: 'trace-audit',
      providerCode: 'qwen-main',
      modelId: 'qwen-plus',
      protocol: 'QWEN_COMPATIBLE',
      enableThinking: false,
    });
    expect(auditJson).not.toHaveProperty('enable_thinking');
    expect(auditJson).not.toHaveProperty('temperature');
  });
});
