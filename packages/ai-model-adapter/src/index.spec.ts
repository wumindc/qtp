import { describe, expect, it } from 'vitest';
import {
  buildChatCompletionsPayload,
  buildEmbeddingsPayload,
  calculateModelTokenCost,
  createChatCompletionsProviderAdapter,
  createEmbeddingsProviderAdapter,
  createModelDiscoveryProviderAdapter,
  normalizeModelUsage,
} from './index';

describe('ai-model-adapter', () => {
  it('builds OpenAI-compatible chat completion payloads', () => {
    expect(buildChatCompletionsPayload({
      traceId: 'trace-1',
      providerCode: 'openai',
      modelId: 'gpt-4.1',
      protocol: 'OPENAI_COMPATIBLE',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.2,
      responseFormat: 'json_object',
      maxTokens: 512,
      stream: false,
    })).toEqual({
      model: 'gpt-4.1',
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
      temperature: 0.2,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    });
  });

  /**
   * @author codex
   * Provider-specific parameters must be modeled explicitly instead of passed through as raw options.
   */
  it('drops arbitrary provider options from provider payloads', () => {
    const chatPayload = buildChatCompletionsPayload({
      traceId: 'trace-raw-provider-options',
      providerCode: 'openai',
      modelId: 'gpt-4.1',
      protocol: 'OPENAI_COMPATIBLE',
      messages: [{ role: 'user', content: 'hi' }],
      providerOptions: { unsafe_wire_field: true },
    } as never);

    const embeddingPayload = buildEmbeddingsPayload({
      traceId: 'trace-raw-embedding-options',
      providerCode: 'openai',
      modelId: 'text-embedding-3-large',
      protocol: 'OPENAI_EMBEDDINGS',
      input: 'ping',
      providerOptions: { unsafe_wire_field: true },
    } as never);

    expect(chatPayload).not.toHaveProperty('unsafe_wire_field');
    expect(embeddingPayload).not.toHaveProperty('unsafe_wire_field');
  });

  /**
   * @author codex
   * Runtime payloads can only emit supported reasoning effort values.
   */
  it('does not pass invalid reasoning effort values to provider payloads', () => {
    const payload = buildChatCompletionsPayload({
      traceId: 'trace-invalid-reasoning',
      providerCode: 'deepseek',
      modelId: 'deepseek-chat',
      protocol: 'OPENAI_COMPATIBLE',
      messages: [{ role: 'user', content: 'hi' }],
      reasoningEffort: { raw: 'vendor-specific' },
    } as never);

    expect(payload).not.toHaveProperty('reasoning_effort');
  });

  it('can explicitly disable Qwen thinking on compatible payloads', () => {
    expect(buildChatCompletionsPayload({
      traceId: 'trace-2',
      providerCode: 'qwen',
      modelId: 'qwen-plus',
      protocol: 'QWEN_COMPATIBLE',
      messages: [{ role: 'user', content: '评分' }],
      enableThinking: false,
    })).toMatchObject({
      model: 'qwen-plus',
      enable_thinking: false,
    });
  });

  it('maps abstract DeepSeek thinking flags inside the AI invocation boundary', () => {
    expect(buildChatCompletionsPayload({
      traceId: 'trace-provider-options',
      providerCode: 'deepseek',
      modelId: 'deepseek-reasoner',
      protocol: 'OPENAI_COMPATIBLE',
      providerKind: 'DEEPSEEK',
      messages: [{ role: 'user', content: 'ping' }],
      enableThinking: false,
    })).toMatchObject({
      model: 'deepseek-reasoner',
      thinking: { type: 'disabled' },
    });
  });

  it('builds embedding payloads with provider dimensions', () => {
    expect(buildEmbeddingsPayload({
      traceId: 'trace-embedding',
      providerCode: 'openai-compatible-main',
      modelId: 'text-embedding-3-large',
      protocol: 'OPENAI_EMBEDDINGS',
      input: 'ping',
      dimensions: 1024,
      encodingFormat: 'float',
    })).toEqual({
      model: 'text-embedding-3-large',
      input: 'ping',
      dimensions: 1024,
      encoding_format: 'float',
    });
  });

  it('invokes OpenAI-compatible providers and normalizes text and usage', async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const adapter = createChatCompletionsProviderAdapter({
      baseUrl: 'https://models.example.com/v1',
      apiKey: 'sk-test',
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify({
          choices: [{ message: { content: '{"passStatus":"PASS"}' } }],
          usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
        }), { status: 200 });
      },
    });

    const result = await adapter.invoke({
      traceId: 'trace-3',
      providerCode: 'openai',
      modelId: 'gpt-4.1',
      protocol: 'OPENAI_COMPATIBLE',
      messages: [{ role: 'user', content: 'judge' }],
    });

    expect(requests[0]?.url).toBe('https://models.example.com/v1/chat/completions');
    expect(requests[0]?.init.headers).toMatchObject({ Authorization: 'Bearer sk-test' });
    expect(result.status).toBe('SUCCEEDED');
    expect(result.content).toBe('{"passStatus":"PASS"}');
    expect(result.usage).toMatchObject({
      normalInputTokens: 11,
      outputTokens: 7,
      totalTokens: 18,
      usageStatus: 'AVAILABLE',
    });
  });

  it('classifies provider auth failures into stable adapter errors', async () => {
    const adapter = createChatCompletionsProviderAdapter({
      baseUrl: 'https://models.example.com/v1',
      apiKey: 'bad-key',
      fetchImpl: async () => new Response('unauthorized', { status: 401 }),
    });

    const result = await adapter.invoke({
      traceId: 'trace-4',
      providerCode: 'openai',
      modelId: 'gpt-4.1',
      protocol: 'OPENAI_COMPATIBLE',
      messages: [{ role: 'user', content: 'judge' }],
    });

    expect(result).toMatchObject({
      status: 'FAILED',
      errorCode: 'PROVIDER_AUTH_FAILED',
    });
  });

  it('invokes OpenAI-compatible embedding providers', async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const adapter = createEmbeddingsProviderAdapter({
      baseUrl: 'https://models.example.com/v1',
      apiKey: 'sk-test',
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }), { status: 200 });
      },
    });

    const result = await adapter.invoke({
      traceId: 'trace-embedding',
      providerCode: 'openai-compatible-main',
      modelId: 'text-embedding-3-large',
      protocol: 'OPENAI_EMBEDDINGS',
      input: 'ping',
    });

    expect(requests[0]?.url).toBe('https://models.example.com/v1/embeddings');
    expect(requests[0]?.init.headers).toMatchObject({ Authorization: 'Bearer sk-test' });
    expect(result).toMatchObject({
      status: 'SUCCEEDED',
      responseJson: { data: [{ embedding: [0.1, 0.2] }] },
    });
  });

  it('discovers provider models through the shared adapter boundary', async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const adapter = createModelDiscoveryProviderAdapter({
      baseUrl: 'https://models.example.com/v1',
      apiKey: 'sk-test',
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify({ data: [{ id: 'qwen-plus' }] }), { status: 200 });
      },
    });

    const result = await adapter.listModels({ traceId: 'trace-models', providerCode: 'qwen-main' });

    expect(requests[0]?.url).toBe('https://models.example.com/v1/models');
    expect(requests[0]?.init).toMatchObject({
      method: 'GET',
      headers: { Authorization: 'Bearer sk-test' },
    });
    expect(result).toMatchObject({
      status: 'SUCCEEDED',
      responseJson: { data: [{ id: 'qwen-plus' }] },
    });
  });

  it('calculates CNY token cost from normalized usage buckets', () => {
    const usage = normalizeModelUsage({
      prompt_tokens: 1000,
      completion_tokens: 500,
      prompt_tokens_details: { cached_tokens: 200 },
    });

    expect(calculateModelTokenCost(usage, {
      currency: 'CNY',
      unit: 'PER_MILLION_TOKENS',
      normalInputPrice: 2,
      cachedInputPrice: 0.5,
      outputPrice: 8,
    })).toEqual({
      currency: 'CNY',
      normalInputCostAmount: 0.0016,
      cachedInputCostAmount: 0.0001,
      outputCostAmount: 0.004,
      totalCostAmount: 0.0057,
      costStatus: 'CALCULATED',
    });
  });
});
