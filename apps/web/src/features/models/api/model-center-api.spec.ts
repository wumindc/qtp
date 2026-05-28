import { beforeEach, describe, expect, it, vi } from 'vitest';
import { postGateway } from '@/lib/api/gateway-client';
import { loadModelCenterData, saveProvider, testModelForm, testProviderForm } from './model-center-api';
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

  it('rejects model center rows with invalid enum values instead of defaulting them', async () => {
    vi.mocked(postGateway)
      .mockResolvedValueOnce({
        list: [
          {
            providerCode: 'provider-1',
            providerType: 'BAD_PROVIDER',
            apiKey: 'sk-should-not-leak',
            apiKeyConfigured: true,
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

    await expect(loadModelCenterData()).rejects.toThrow('模型中心响应包含不支持的供应商类型：BAD_PROVIDER');
  });

  it('does not turn gateway list loading failures into an empty model center', async () => {
    vi.mocked(postGateway).mockRejectedValue(new Error('gateway down'));

    await expect(loadModelCenterData()).rejects.toThrow('gateway down');
  });

  it('rejects models referencing missing providers instead of assigning a default provider type', async () => {
    vi.mocked(postGateway)
      .mockResolvedValueOnce({ list: [] })
      .mockResolvedValueOnce({
        list: [
          {
            id: '1',
            providerCode: 'missing-provider',
            modelType: 'LLM',
            protocol: 'OPENAI_CHAT_COMPLETIONS',
          },
        ],
      });

    await expect(loadModelCenterData()).rejects.toThrow('模型中心响应包含不存在的模型供应商：missing-provider');
  });

  it('rejects provider rows missing required string fields instead of creating blank providers', async () => {
    vi.mocked(postGateway)
      .mockResolvedValueOnce({
        list: [
          {
            providerName: 'DeepSeek 生产环境',
            providerType: 'DEEPSEEK',
            baseUrl: 'https://api.deepseek.com',
          },
        ],
      })
      .mockResolvedValueOnce({ list: [] });

    await expect(loadModelCenterData()).rejects.toThrow('模型中心响应缺少供应商编码');
  });

  it('rejects model rows missing required string fields instead of creating blank models', async () => {
    vi.mocked(postGateway)
      .mockResolvedValueOnce({
        list: [
          {
            providerCode: 'deepseek-prod',
            providerName: 'DeepSeek 生产环境',
            providerType: 'DEEPSEEK',
            baseUrl: 'https://api.deepseek.com',
            apiKeyConfigured: true,
            enabled: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        list: [
          {
            id: 'model-1',
            providerCode: 'deepseek-prod',
            modelName: 'DeepSeek Chat',
            modelType: 'LLM',
            protocol: 'DEEPSEEK_CHAT_COMPLETIONS',
          },
        ],
      });

    await expect(loadModelCenterData()).rejects.toThrow('模型中心响应缺少模型 ID');
  });

  it('rejects rows missing enabled status instead of defaulting them to enabled', async () => {
    vi.mocked(postGateway)
      .mockResolvedValueOnce({
        list: [
          {
            providerCode: 'deepseek-prod',
            providerName: 'DeepSeek 生产环境',
            providerType: 'DEEPSEEK',
            baseUrl: 'https://api.deepseek.com',
            apiKeyConfigured: true,
          },
        ],
      })
      .mockResolvedValueOnce({ list: [] });

    await expect(loadModelCenterData()).rejects.toThrow('模型中心响应缺少供应商启停状态');
  });

  it('rejects model rows missing configuration objects instead of defaulting them to empty objects', async () => {
    vi.mocked(postGateway)
      .mockResolvedValueOnce({
        list: [
          {
            providerCode: 'deepseek-prod',
            providerName: 'DeepSeek 生产环境',
            providerType: 'DEEPSEEK',
            baseUrl: 'https://api.deepseek.com',
            apiKeyConfigured: true,
            enabled: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        list: [
          {
            id: 'model-1',
            providerCode: 'deepseek-prod',
            modelName: 'DeepSeek Chat',
            modelId: 'deepseek-chat',
            modelType: 'LLM',
            protocol: 'DEEPSEEK_CHAT_COMPLETIONS',
            enabled: true,
          },
        ],
      });

    await expect(loadModelCenterData()).rejects.toThrow('模型中心响应缺少模型参数配置');
  });

  it('rejects malformed model configuration objects instead of casting them', async () => {
    vi.mocked(postGateway)
      .mockResolvedValueOnce({
        list: [
          {
            providerCode: 'deepseek-prod',
            providerName: 'DeepSeek 生产环境',
            providerType: 'DEEPSEEK',
            baseUrl: 'https://api.deepseek.com',
            apiKeyConfigured: true,
            enabled: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        list: [
          {
            id: 'model-1',
            providerCode: 'deepseek-prod',
            modelName: 'DeepSeek Chat',
            modelId: 'deepseek-chat',
            modelType: 'LLM',
            protocol: 'DEEPSEEK_CHAT_COMPLETIONS',
            parameters: [],
            capabilities: {},
            limits: {},
            enabled: true,
          },
        ],
      });

    await expect(loadModelCenterData()).rejects.toThrow('模型中心响应模型参数配置不是对象');
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

  it('omits blank API keys when updating a provider', async () => {
    vi.mocked(postGateway).mockResolvedValue({});

    await saveProvider({
      name: 'DeepSeek 生产环境',
      type: 'DEEPSEEK',
      baseUrl: 'https://api.deepseek.com',
      apiKey: '',
    }, 'deepseek-prod');

    expect(postGateway).toHaveBeenCalledWith('ai', '/provider/update.do', {
      providerCode: 'deepseek-prod',
      data: {
        providerName: 'DeepSeek 生产环境',
        providerType: 'DEEPSEEK',
        baseUrl: 'https://api.deepseek.com',
        enabled: true,
      },
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
      apiKeyConfigured: true,
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
        normalInputPrice: '',
        cachedInputPrice: '',
        outputPrice: '',
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
