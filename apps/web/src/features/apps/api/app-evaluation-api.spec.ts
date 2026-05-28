/**
 * 应用评估配置 API 映射测试
 * @author codex
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { postGateway } from '@/lib/api/gateway-client';
import { loadEvaluationConfig, loadEvaluationModels, saveEvaluationConfig } from './app-evaluation-api';

vi.mock('@/lib/api/gateway-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/gateway-client')>();
  return {
    ...actual,
    postGateway: vi.fn(),
  };
});

const postGatewayMock = vi.mocked(postGateway);

describe('app evaluation api mapping', () => {
  beforeEach(() => {
    postGatewayMock.mockReset();
  });

  it('rejects malformed evaluation configs instead of trusting defaultable fields', async () => {
    postGatewayMock.mockResolvedValue({
      appCode: 'app-1',
      configured: true,
      modelId: '',
      promptOverrideEnabled: false,
      systemPrompt: '你是 AI 应用质量评估裁判。',
      customPrompt: '',
      effectivePrompt: '你是 AI 应用质量评估裁判。',
      evaluationConcurrency: 3,
    });

    await expect(loadEvaluationConfig('app-1')).rejects.toThrow('评估配置响应缺少模型 ID');
  });

  it('maps saved evaluation configs through the same strict response contract', async () => {
    postGatewayMock.mockResolvedValue({
      appCode: 'app-1',
      configured: true,
      modelId: '4',
      promptOverrideEnabled: false,
      systemPrompt: '',
      customPrompt: '',
      effectivePrompt: '',
      evaluationConcurrency: 3,
    });

    await expect(saveEvaluationConfig('app-1', {
      modelId: '4',
      promptOverrideEnabled: false,
      customPrompt: '',
      evaluationConcurrency: 3,
    })).rejects.toThrow('评估配置响应缺少系统提示词');
  });

  it('rejects malformed model providers instead of creating empty provider options', async () => {
    postGatewayMock
      .mockResolvedValueOnce({
        list: [
          {
            providerCode: '',
            providerName: '通义千问',
            enabled: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        list: [
          {
            id: '4',
            providerCode: '',
            modelName: 'qwen3.5-plus',
            modelId: 'qwen3.5-plus',
            modelType: 'LLM',
            enabled: true,
          },
        ],
      });

    await expect(loadEvaluationModels()).rejects.toThrow('评估模型供应商响应缺少供应商编码');
  });

  it('rejects model rows without an explicit LLM model type', async () => {
    postGatewayMock
      .mockResolvedValueOnce({
        list: [
          {
            providerCode: 'provider-qwen',
            providerName: '通义千问',
            enabled: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        list: [
          {
            id: '4',
            providerCode: 'provider-qwen',
            modelName: 'qwen3.5-plus',
            modelId: 'qwen3.5-plus',
            enabled: true,
          },
        ],
      });

    await expect(loadEvaluationModels()).rejects.toThrow('评估模型响应缺少模型类型');
  });

  it('rejects model rows whose provider is missing instead of inventing provider names', async () => {
    postGatewayMock
      .mockResolvedValueOnce({ list: [] })
      .mockResolvedValueOnce({
        list: [
          {
            id: '4',
            providerCode: 'missing-provider',
            modelName: 'qwen3.5-plus',
            modelId: 'qwen3.5-plus',
            modelType: 'LLM',
            enabled: true,
          },
        ],
      });

    await expect(loadEvaluationModels()).rejects.toThrow('评估模型响应包含不存在的模型供应商：missing-provider');
  });

  it('returns only enabled LLM models backed by enabled providers', async () => {
    postGatewayMock
      .mockResolvedValueOnce({
        list: [
          {
            providerCode: 'provider-qwen',
            providerName: '通义千问',
            enabled: true,
          },
          {
            providerCode: 'provider-disabled',
            providerName: '停用供应商',
            enabled: false,
          },
        ],
      })
      .mockResolvedValueOnce({
        list: [
          {
            id: '4',
            providerCode: 'provider-qwen',
            modelName: 'qwen3.5-plus',
            modelId: 'qwen3.5-plus',
            modelType: 'LLM',
            enabled: true,
          },
          {
            id: '5',
            providerCode: 'provider-qwen',
            modelName: '停用模型',
            modelId: 'disabled-model',
            modelType: 'LLM',
            enabled: false,
          },
          {
            id: '6',
            providerCode: 'provider-disabled',
            modelName: '供应商停用模型',
            modelId: 'disabled-provider-model',
            modelType: 'LLM',
            enabled: true,
          },
        ],
      });

    await expect(loadEvaluationModels()).resolves.toEqual([
      {
        id: '4',
        name: 'qwen3.5-plus',
        modelId: 'qwen3.5-plus',
        providerCode: 'provider-qwen',
        providerName: '通义千问',
      },
    ]);
  });
});
