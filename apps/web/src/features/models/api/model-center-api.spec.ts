import { beforeEach, describe, expect, it, vi } from 'vitest';
import { postGateway } from '@/lib/api/gateway-client';
import { loadModelCenterData, testModelForm, testProviderForm } from './model-center-api';
import type { ModelProviderRecord } from '../types';

vi.mock('@/lib/api/gateway-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/gateway-client')>('@/lib/api/gateway-client');
  return {
    ...actual,
    postGateway: vi.fn(),
  };
});

describe('loadModelCenterData', () => {
  beforeEach(() => {
    vi.mocked(postGateway).mockReset();
  });

  it('falls back safely when gateway rows contain invalid enum values', async () => {
    vi.mocked(postGateway)
      .mockResolvedValueOnce({
        list: [
          {
            providerCode: 'provider-1',
            providerType: 'BAD_PROVIDER',
          },
        ],
      })
      .mockResolvedValueOnce({
        list: [
          {
            providerCode: 'provider-1',
            modelType: 'BAD_MODEL',
            protocol: 'BAD_PROTOCOL',
          },
        ],
      });

    await expect(loadModelCenterData()).resolves.toEqual({
      providers: [
        {
          id: 'provider-1',
          code: 'provider-1',
          name: '',
          type: 'OPENAI_COMPATIBLE',
          baseUrl: '',
          apiKey: '',
          status: '启用',
        },
      ],
      models: [
        {
          id: '',
          name: '',
          provider: 'provider-1',
          providerName: '',
          providerType: 'OPENAI_COMPATIBLE',
          modelId: '',
          modelType: 'LLM',
          protocol: 'OPENAI_CHAT_COMPLETIONS',
          parameters: {},
          capabilities: {},
          limits: {},
          status: '启用',
        },
      ],
    });
  });
});

describe('model center form connection tests', () => {
  beforeEach(() => {
    vi.mocked(postGateway).mockReset();
  });

  it('tests provider form configuration through the gateway client', async () => {
    vi.mocked(postGateway).mockResolvedValue({ message: '供应商连接配置可用' });

    await testProviderForm({
      name: 'DeepSeek 生产环境',
      type: 'DEEPSEEK',
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-test',
    });

    expect(postGateway).toHaveBeenCalledWith('ai', '/provider/test-config.do', {
      providerType: 'DEEPSEEK',
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-test',
    });
  });

  it('tests model form configuration through the gateway client', async () => {
    vi.mocked(postGateway).mockResolvedValue({ message: '模型连接配置可用' });
    const provider: ModelProviderRecord = {
      id: 'deepseek-prod',
      code: 'deepseek-prod',
      name: 'DeepSeek 生产环境',
      type: 'DEEPSEEK',
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-test',
      status: '启用',
    };

    await testModelForm(
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
      },
      provider,
    );

    expect(postGateway).toHaveBeenCalledWith(
      'ai',
      '/provider/model/test-config.do',
      expect.objectContaining({
        modelId: 'deepseek-chat',
        modelType: 'LLM',
        providerCode: 'deepseek-prod',
      }),
    );
  });
});
