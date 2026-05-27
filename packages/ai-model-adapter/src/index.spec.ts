import { describe, expect, it } from 'vitest';
import {
  buildChatCompletionsPayload,
  calculateModelTokenCost,
  createChatCompletionsProviderAdapter,
  createFailedModelInvocationResult,
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

  it('normalizes cached, normal input and output token usage', () => {
    expect(normalizeModelUsage({
      input_tokens: 100,
      output_tokens: 20,
      total_tokens: 120,
      prompt_tokens_details: { cached_tokens: 40 },
    })).toMatchObject({
      normalInputTokens: 60,
      cachedInputTokens: 40,
      outputTokens: 20,
      totalTokens: 120,
      usageStatus: 'AVAILABLE',
    });
  });

  it('creates failed invocation results with elapsed time and no usage', () => {
    expect(createFailedModelInvocationResult('PROVIDER_TIMEOUT', '模型调用超时', 5000)).toEqual({
      status: 'FAILED',
      elapsedMs: 5000,
      errorCode: 'PROVIDER_TIMEOUT',
      errorMessage: '模型调用超时',
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
