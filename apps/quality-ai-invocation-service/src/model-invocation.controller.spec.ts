import { describe, expect, it, vi } from 'vitest';
import { ModelInvocationController } from './model-invocation.controller';

describe('ModelInvocationController', () => {
  it('invokes chat models through the shared provider adapter', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'pong' } }],
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
    }), { status: 200 }));
    const controller = new ModelInvocationController(fetchImpl as unknown as typeof fetch);

    const response = await controller.invokeChat({
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

    expect(response.data).toMatchObject({ status: 'SUCCEEDED', content: 'pong' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
    const firstCall = fetchImpl.mock.calls[0] as unknown as [unknown, RequestInit];
    const body = JSON.parse(String(firstCall[1].body));
    expect(body).toMatchObject({ model: 'qwen-plus', enable_thinking: false });
  });

  it('invokes embedding models through the shared provider adapter', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      data: [{ embedding: [0.1, 0.2] }],
    }), { status: 200 }));
    const controller = new ModelInvocationController(fetchImpl as unknown as typeof fetch);

    const response = await controller.invokeEmbedding({
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

    expect(response.data.status).toBe('SUCCEEDED');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.com/v1/embeddings',
      expect.objectContaining({ method: 'POST' }),
    );
    const firstCall = fetchImpl.mock.calls[0] as unknown as [unknown, RequestInit];
    const body = JSON.parse(String(firstCall[1].body));
    expect(body).toMatchObject({ model: 'text-embedding-3-large', input: 'ping', dimensions: 1024 });
  });

  it('discovers provider models through the shared provider adapter', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      data: [{ id: 'qwen-plus' }],
    }), { status: 200 }));
    const controller = new ModelInvocationController(fetchImpl as unknown as typeof fetch);

    const response = await controller.listModels({
      connection: {
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiKey: 'sk-test',
      },
      request: {
        traceId: 'trace-models',
        providerCode: 'qwen-main',
      },
    });

    expect(response.data).toMatchObject({ status: 'SUCCEEDED', responseJson: { data: [{ id: 'qwen-plus' }] } });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
