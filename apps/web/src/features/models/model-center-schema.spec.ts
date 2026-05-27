import { describe, expect, it } from 'vitest';
import { buildModelPayload, parseTokenCount, providerToOptionLabel } from './model-center-schema';
import type { ModelProviderRecord } from './types';

const provider: ModelProviderRecord = {
  id: 'deepseek-prod',
  code: 'deepseek-prod',
  name: 'DeepSeek 生产环境',
  type: 'DEEPSEEK',
  baseUrl: 'https://api.deepseek.com',
  apiKey: 'sk-test',
  status: '启用',
};

describe('model-center-schema', () => {
  it('parses compact token units', () => {
    expect(parseTokenCount('128k')).toBe(128000);
    expect(parseTokenCount('1m')).toBe(1000000);
    expect(parseTokenCount('4,096')).toBe(4096);
    expect(parseTokenCount('bad')).toBeUndefined();
  });

  it('builds the model payload without user-facing model codes', () => {
    expect(
      buildModelPayload(
        {
          name: 'DeepSeek Chat',
          provider: 'deepseek-prod',
          modelId: 'deepseek-chat',
          modelType: 'LLM',
          contextWindow: '128k',
          maxOutputTokens: '4k',
          stream: 'true',
          jsonMode: 'false',
          toolCalling: 'false',
          thinkingEnabled: 'true',
          dimensions: '',
          normalInputPrice: '0.8',
          cachedInputPrice: '0.2',
          outputPrice: '2',
        },
        provider,
      ),
    ).toEqual({
      modelName: 'DeepSeek Chat',
      providerCode: 'deepseek-prod',
      modelId: 'deepseek-chat',
      modelType: 'LLM',
      protocol: 'DEEPSEEK_CHAT_COMPLETIONS',
      parameters: {
        maxOutputTokens: 4000,
        stream: true,
        jsonMode: false,
        toolCalling: false,
        thinkingEnabled: true,
      },
      capabilities: {
        stream: true,
        jsonMode: false,
        toolCalling: false,
        reasoning: true,
      },
      limits: {
        contextWindow: 128000,
        maxOutputTokens: 4000,
        pricing: {
          currency: 'CNY',
          unit: 'PER_MILLION_TOKENS',
          normalInputPrice: 0.8,
          cachedInputPrice: 0.2,
          outputPrice: 2,
        },
      },
    });
  });

  it('formats provider option labels', () => {
    expect(providerToOptionLabel(provider)).toBe('DeepSeek 生产环境 (DeepSeek 官方)');
  });
});
