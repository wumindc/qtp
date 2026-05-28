import { describe, expect, it } from 'vitest';
import { buildModelPayload, parseTokenCount, providerToOptionLabel } from './model-center-schema';
import type { ModelProviderRecord } from './types';

const provider: ModelProviderRecord = {
  id: 'deepseek-prod',
  code: 'deepseek-prod',
  name: 'DeepSeek 生产环境',
  type: 'DEEPSEEK',
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  apiKeyConfigured: true,
  status: '启用',
};

const validLlmForm = {
  name: 'DeepSeek Chat',
  provider: 'deepseek-prod',
  modelId: 'deepseek-chat',
  modelType: 'LLM' as const,
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
      buildModelPayload(validLlmForm, provider),
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

  it('rejects invalid LLM token limits instead of silently defaulting them', () => {
    expect(() => buildModelPayload({ ...validLlmForm, maxOutputTokens: 'many' }, provider)).toThrow('最大输出 Token 不是合法正整数');
    expect(() => buildModelPayload({ ...validLlmForm, contextWindow: 'wide' }, provider)).toThrow('上下文窗口不是合法正整数');
  });

  it('rejects invalid embedding dimensions instead of dropping them from the payload', () => {
    expect(() =>
      buildModelPayload(
        {
          ...validLlmForm,
          modelType: 'EMBEDDING',
          modelId: 'text-embedding-v4',
          dimensions: 'large',
        },
        { ...provider, type: 'QWEN' },
      ),
    ).toThrow('向量维度不是合法正整数');
  });

  it('rejects invalid pricing instead of dropping it from the payload', () => {
    expect(() => buildModelPayload({ ...validLlmForm, normalInputPrice: 'free' }, provider)).toThrow('普通输入价格必须为空或非负数');
    expect(() => buildModelPayload({ ...validLlmForm, cachedInputPrice: '-1' }, provider)).toThrow('缓存命中输入价格必须为空或非负数');
    expect(() => buildModelPayload({ ...validLlmForm, outputPrice: 'expensive' }, provider)).toThrow('输出价格必须为空或非负数');
  });

  it('formats provider option labels', () => {
    expect(providerToOptionLabel(provider)).toBe('DeepSeek 生产环境 (DeepSeek 官方)');
  });
});
