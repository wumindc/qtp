import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  ProviderService,
  type ModelRecord,
  type ProviderDataStore,
  type ProviderRecord,
} from './provider.service';

function createProviderFetch(status = 200, body = '{}') {
  return vi.fn(async () => new Response(body, { status }));
}

function createInvocationFetch(data: Record<string, unknown> = { status: 'SUCCEEDED', content: 'pong', elapsedMs: 1 }) {
  return createProviderFetch(200, JSON.stringify({ success: true, data }));
}

function createChatCompletionFetch() {
  return createInvocationFetch();
}

function createProviderDataStore(): ProviderDataStore {
  const providers = new Map<string, ProviderRecord>();
  const models = new Map<string, ModelRecord>();
  let nextModelId = 1;
  return {
    listProviders: async () => Array.from(providers.values()),
    listModels: async () => Array.from(models.values()),
    findProvider: async (providerCode) => providers.get(providerCode) ?? null,
    findModel: async (id) => models.get(id) ?? null,
    createProvider: async (record) => {
      providers.set(record.providerCode, record);
      return record;
    },
    updateProvider: async (record) => {
      providers.set(record.providerCode, record);
      return record;
    },
    deleteProvider: async (providerCode) => {
      const provider = providers.get(providerCode);
      if (!provider) throw new Error('供应商不存在');
      providers.delete(providerCode);
      return provider;
    },
    createModel: async (record) => {
      const saved = { ...record, id: String(nextModelId) };
      nextModelId += 1;
      models.set(saved.id, saved);
      return saved;
    },
    updateModel: async (record) => {
      models.set(record.id, record);
      return record;
    },
    deleteModel: async (id) => {
      const model = models.get(id);
      if (!model) throw new Error('模型不存在');
      models.delete(id);
      return model;
    },
  };
}

function createProviderService(fetchImpl: typeof fetch = createInvocationFetch() as unknown as typeof fetch) {
  return new ProviderService(fetchImpl, createProviderDataStore());
}

function llmModelConfig() {
  return {
    parameters: { maxOutputTokens: 4096 },
    capabilities: { stream: true, jsonMode: true, toolCalling: true },
    limits: { contextWindow: 128000, maxOutputTokens: 4096 },
  };
}

function embeddingModelConfig() {
  return {
    parameters: { dimensions: 1024 },
    capabilities: { embedding: true },
    limits: { maxInputTokens: 8192, embeddingDimensions: 1024 },
  };
}

describe('ProviderService', () => {
  it('does not keep a production in-memory fallback store', () => {
    const source = readFileSync(join(process.cwd(), 'src/modules/provider/provider.service.ts'), 'utf8');

    expect(source).not.toContain('process.env.VITEST');
    expect(source).not.toContain('private readonly providers = new Map');
    expect(source).not.toContain('private readonly models = new Map');
    expect(source).not.toContain('createMemoryModelId');
    expect(source).not.toContain('saved ?? record');
  });

  it('does not keep default enum fallbacks for model center records', () => {
    const source = readFileSync(join(process.cwd(), 'src/modules/provider/provider.service.ts'), 'utf8');

    expect(source).not.toContain("value === 'QWEN' || value === 'DEEPSEEK' ? value : 'OPENAI_COMPATIBLE'");
    expect(source).not.toContain("value === 'EMBEDDING' ? 'EMBEDDING' : 'LLM'");
    expect(source).not.toContain('return ProviderService.resolveProtocol(providerType, modelType);');
  });

  it('does not build provider wire endpoints inside the platform service', () => {
    const source = readFileSync(join(process.cwd(), 'src/modules/provider/provider.service.ts'), 'utf8');

    expect(source).not.toContain("this.buildEndpoint(baseUrl, 'models')");
    expect(source).not.toContain("this.buildEndpoint(provider.baseUrl, 'chat/completions')");
    expect(source).not.toContain("this.buildEndpoint(provider.baseUrl, 'embeddings')");
    expect(source).not.toContain('private buildEndpoint(');
  });

  it('does not hide malformed provider database rows behind empty/default values', () => {
    const source = readFileSync(join(process.cwd(), 'src/modules/provider/provider.service.ts'), 'utf8');

    expect(source).not.toContain('providerCode: String(data.providerCode)');
    expect(source).not.toContain('providerName: String(data.providerName)');
    expect(source).not.toContain("baseUrl: String(data.baseUrl ?? '')");
    expect(source).not.toContain("apiKey: String(data.apiKey ?? '')");
    expect(source).not.toContain('id: String(data.id)');
    expect(source).not.toContain('modelName: String(data.modelName)');
    expect(source).not.toContain("modelId: String(data.modelId ?? '')");
    expect(source).not.toContain('enabled: data.enabled !== false');
    expect(source).not.toContain('readOptionalJsonObject');
    expect(source).not.toContain('request.parameters ?? {}');
    expect(source).not.toContain('request.capabilities ?? {}');
    expect(source).not.toContain('request.limits ?? {}');
  });

  it('contains the first supported provider types', () => {
    const service = createProviderService();

    expect(service.supportedTypes()).toEqual(['OPENAI_COMPATIBLE', 'QWEN', 'DEEPSEEK']);
  });

  it('starts with no provider or model records', async () => {
    const service = createProviderService();

    expect((await service.list({ currentPage: 1, linesPerPage: 10 })).page.totalNum).toBe(0);
    expect((await service.modelList({}, { currentPage: 1, linesPerPage: 10 })).page.totalNum).toBe(0);
  });

  it('creates and connection-tests a provider configuration', async () => {
    const fetchMock = createInvocationFetch({ status: 'SUCCEEDED', responseJson: { data: [] }, elapsedMs: 1 });
    const service = createProviderService(fetchMock as unknown as typeof fetch);
    const created = await service.create({
      providerCode: 'deepseek-main',
      providerName: 'DeepSeek 主模型',
      providerType: 'DEEPSEEK',
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-test',
    });

    expect(created.enabled).toBe(true);
    expect((await service.testConnection('deepseek-main')).status).toBe('SUCCESS');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3105/ai-quality-platform/model/models/list.do',
      expect.objectContaining({ method: 'POST' }),
    );
    const firstCall = fetchMock.mock.calls[0] as unknown as [unknown, RequestInit];
    expect(JSON.parse(String(firstCall[1].body))).toMatchObject({
      connection: {
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'sk-test',
      },
      request: {
        providerCode: 'transient-provider',
      },
    });
  });

  it('generates internal provider codes when the UI does not submit one', async () => {
    const service = createProviderService();

    const firstProvider = await service.create({
      providerName: 'DeepSeek 生产环境',
      providerType: 'DEEPSEEK',
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-test',
    });
    const secondProvider = await service.create({
      providerName: 'DeepSeek 生产环境',
      providerType: 'DEEPSEEK',
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-test',
    });

    expect(firstProvider.providerCode).toBe('provider-deepseek');
    expect(secondProvider.providerCode).toBe('provider-deepseek-2');
  });

  it('keeps provider API keys out of public provider records', async () => {
    const service = createProviderService();

    const created = await service.create({
      providerCode: 'deepseek-main',
      providerName: 'DeepSeek 生产环境',
      providerType: 'DEEPSEEK',
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-real-secret',
    });
    const listed = await service.list({ currentPage: 1, linesPerPage: 10 });

    expect(created.apiKey).toBe('');
    expect(created.apiKeyConfigured).toBe(true);
    expect(listed.list[0]).toMatchObject({ apiKey: '', apiKeyConfigured: true });
    expect(JSON.stringify(listed.list)).not.toContain('sk-real-secret');
    await expect(service.testConnection('deepseek-main')).resolves.toMatchObject({ status: expect.any(String) });
  });

  it('tests transient provider config without requiring a saved provider', async () => {
    const fetchMock = createInvocationFetch({ status: 'SUCCEEDED', responseJson: { data: [] }, elapsedMs: 1 });
    const service = createProviderService(fetchMock as unknown as typeof fetch);

    const response = await service.testConfig({
      providerType: 'QWEN',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'sk-test',
    });

    expect(response.status).toBe('SUCCESS');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3105/ai-quality-platform/model/models/list.do',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(response).not.toHaveProperty('endpoint');
  });

  it('creates a disabled provider and rejects duplicate provider identifiers', async () => {
    const service = createProviderService();
    const created = await service.create({
      providerCode: 'deepseek-main',
      providerName: 'DeepSeek 主模型',
      providerType: 'DEEPSEEK',
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-test',
      enabled: false,
    });

    expect(created.enabled).toBe(false);
    await expect(
      service.create({
        providerCode: 'deepseek-main',
        providerName: 'DeepSeek 重复',
        providerType: 'DEEPSEEK',
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'sk-test',
      }),
    ).rejects.toThrow('供应商已存在');
  });

  it('updates, disables, and deletes provider configurations', async () => {
    const service = createProviderService();
    await service.create({
      providerCode: 'qwen-main',
      providerName: '通义千问',
      providerType: 'QWEN',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'sk-test',
    });

    expect((await service.update('qwen-main', { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' })).baseUrl).toContain(
      'dashscope',
    );
    expect((await service.changeStatus('qwen-main', false)).enabled).toBe(false);
    expect((await service.delete('qwen-main')).providerCode).toBe('qwen-main');
  });

  it('keeps unexpected request fields out of provider and model records', async () => {
    const service = createProviderService();
    await service.create({
      providerCode: 'qwen-main',
      providerName: '通义千问',
      providerType: 'QWEN',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'sk-test',
    });

    const updatedProvider = await service.update('qwen-main', {
      providerName: '通义千问生产环境',
      temporaryUiOnlyField: 'should-not-leak',
    } as Parameters<ProviderService['update']>[1] & Record<string, unknown>);
    expect(updatedProvider).not.toHaveProperty('temporaryUiOnlyField');

    const model = await service.createModel({
      modelName: 'Qwen Plus 模型',
      providerCode: 'qwen-main',
      modelId: 'qwen-plus',
      modelType: 'LLM',
      ...llmModelConfig(),
    });

    const updatedModel = await service.updateModel(model.id, {
      parameters: { temperature: 0.1 },
      transientEditorState: { expanded: true },
    } as Parameters<ProviderService['updateModel']>[1] & Record<string, unknown>);
    expect(updatedModel).not.toHaveProperty('transientEditorState');
  });

  it('blocks deleting a provider referenced by models', async () => {
    const service = createProviderService();
    await service.create({
      providerCode: 'openai-compatible-main',
      providerName: 'OpenAI 兼容供应商',
      providerType: 'OPENAI_COMPATIBLE',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test',
    });
    await service.createModel({
      modelName: '质量评估模型',
      providerCode: 'openai-compatible-main',
      modelId: 'quality-judge',
      modelType: 'LLM',
      ...llmModelConfig(),
    });

    await expect(service.delete('openai-compatible-main')).rejects.toThrow('该供应商下仍有关联模型');
  });

  it('manages LLM models under a provider source using database ids', async () => {
    const fetchMock = createChatCompletionFetch();
    const service = createProviderService(fetchMock as unknown as typeof fetch);
    await service.create({
      providerCode: 'qwen-main',
      providerName: '通义千问',
      providerType: 'QWEN',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'sk-test',
    });

    const created = await service.createModel({
      modelName: 'Qwen Plus 模型',
      providerCode: 'qwen-main',
      modelId: 'qwen-plus',
      modelType: 'LLM',
      parameters: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
      capabilities: { stream: true, jsonMode: true, toolCalling: true },
      limits: {
        pricing: {
          currency: 'CNY',
          unit: 'PER_MILLION_TOKENS',
          normalInputPrice: 0.8,
          cachedInputPrice: 0.2,
          outputPrice: 2,
        },
      },
    });

    expect(created.enabled).toBe(true);
    expect(created.protocol).toBe('DASHSCOPE_COMPATIBLE_CHAT');
    expect(created.parameters.temperature).toBe(0.2);
    expect(created.limits.pricing).toEqual({
      currency: 'CNY',
      unit: 'PER_MILLION_TOKENS',
      normalInputPrice: 0.8,
      cachedInputPrice: 0.2,
      outputPrice: 2,
      cacheWriteInputPrice: null,
    });
    expect((await service.modelList({ providerCode: 'qwen-main', modelType: 'LLM' }, { currentPage: 1, linesPerPage: 10 })).page.totalNum).toBe(1);
    expect(await service.testModelConnection(created.id)).toMatchObject({
      id: created.id,
      status: 'SUCCESS',
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://127.0.0.1:3105/ai-quality-platform/model/chat/invoke.do',
      expect.objectContaining({ method: 'POST' }),
    );
    expect((await service.updateModel(created.id, { parameters: { temperature: 0.1 } })).parameters.temperature).toBe(0.1);
    expect((await service.changeModelStatus(created.id, false)).enabled).toBe(false);
    expect((await service.deleteModel(created.id)).id).toBe(created.id);
  });

  it('rejects unsupported model types instead of treating them as LLM', async () => {
    const service = createProviderService();
    await service.create({
      providerCode: 'qwen-main',
      providerName: '通义千问',
      providerType: 'QWEN',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'sk-test',
    });

    await expect(service.createModel({
      modelName: '错误类型模型',
      providerCode: 'qwen-main',
      modelId: 'bad-model',
      modelType: 'BAD_MODEL',
      ...llmModelConfig(),
    } as unknown as Parameters<ProviderService['createModel']>[0])).rejects.toThrow('不支持的模型类型');
  });

  it('rejects model creation requests missing explicit configuration objects', async () => {
    const service = createProviderService();
    await service.create({
      providerCode: 'qwen-main',
      providerName: '通义千问',
      providerType: 'QWEN',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'sk-test',
    });

    await expect(
      service.createModel({
        modelName: 'Qwen Plus 模型',
        providerCode: 'qwen-main',
        modelId: 'qwen-plus',
        modelType: 'LLM',
      } as Parameters<ProviderService['createModel']>[0]),
    ).rejects.toThrow('模型参数配置不能为空');
  });

  it('rejects transient model tests missing explicit configuration objects', async () => {
    const service = createProviderService();
    await service.create({
      providerCode: 'qwen-main',
      providerName: '通义千问',
      providerType: 'QWEN',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'sk-test',
    });

    await expect(
      service.testModelConfigPayload({
        modelName: 'Qwen Plus 模型',
        providerCode: 'qwen-main',
        modelId: 'qwen-plus',
        modelType: 'LLM',
      } as Parameters<ProviderService['testModelConfigPayload']>[0]),
    ).rejects.toThrow('模型参数配置不能为空');
  });

  it('rejects negative model token prices', async () => {
    const service = createProviderService();
    await service.create({
      providerCode: 'qwen-main',
      providerName: '通义千问',
      providerType: 'QWEN',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'sk-test',
    });

    await expect(service.createModel({
      modelName: 'Qwen Plus 模型',
      providerCode: 'qwen-main',
      modelId: 'qwen-plus',
      modelType: 'LLM',
      parameters: { maxOutputTokens: 4096 },
      capabilities: { stream: true, jsonMode: true, toolCalling: true },
      limits: {
        pricing: {
          currency: 'CNY',
          unit: 'PER_MILLION_TOKENS',
          normalInputPrice: -1,
          outputPrice: 2,
        },
      },
    })).rejects.toThrow('模型价格不能为负数');
  });

  it('supports embedding model test payloads for compatible providers', async () => {
    const fetchMock = createInvocationFetch({ status: 'SUCCEEDED', responseJson: { data: [{ embedding: [0.1] }] }, elapsedMs: 1 });
    const service = createProviderService(fetchMock as unknown as typeof fetch);
    await service.create({
      providerCode: 'openai-compatible-main',
      providerName: 'OpenAI 兼容供应商',
      providerType: 'OPENAI_COMPATIBLE',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test',
    });

    const created = await service.createModel({
      modelName: 'Embedding 模型',
      providerCode: 'openai-compatible-main',
      modelId: 'text-embedding-3-large',
      modelType: 'EMBEDDING',
      ...embeddingModelConfig(),
    });

    expect(created.protocol).toBe('OPENAI_EMBEDDINGS');
    expect(created.capabilities.embedding).toBe(true);
    expect((await service.testModelConnection(created.id)).status).toBe('SUCCESS');
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://127.0.0.1:3105/ai-quality-platform/model/embedding/invoke.do',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('tests transient model configuration before saving it', async () => {
    const fetchMock = createInvocationFetch();
    const service = createProviderService(fetchMock as unknown as typeof fetch);
    await service.create({
      providerCode: 'qwen-main',
      providerName: '通义千问',
      providerType: 'QWEN',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'sk-test',
    });

    const response = await service.testModelConfigPayload({
      modelName: 'Qwen Plus 模型',
      providerCode: 'qwen-main',
      modelId: 'qwen-plus',
      modelType: 'LLM',
      parameters: { thinkingEnabled: false, reasoningEffort: { raw: 'vendor-specific' } } as never,
      limits: { contextWindow: 128000, maxOutputTokens: 4096 },
      capabilities: { stream: true, jsonMode: true, toolCalling: true },
    });

    expect(response).toMatchObject({
      id: 'transient-model-config',
      modelId: 'qwen-plus',
      status: 'SUCCESS',
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://127.0.0.1:3105/ai-quality-platform/model/chat/invoke.do',
      expect.objectContaining({ method: 'POST' }),
    );
    const lastCall = fetchMock.mock.calls.at(-1) as unknown as [unknown, RequestInit];
    const payload = JSON.parse(String(lastCall[1].body));
    expect(payload).toMatchObject({
      connection: {
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiKey: 'sk-test',
      },
      request: {
        modelId: 'qwen-plus',
        enableThinking: false,
      },
    });
    expect(payload.request).not.toHaveProperty('reasoningEffort');
    expect((await service.modelList({}, { currentPage: 1, linesPerPage: 10 })).page.totalNum).toBe(0);
  });

  it('keeps DeepSeek wire thinking payloads inside the AI invocation boundary', async () => {
    const fetchMock = createInvocationFetch();
    const service = createProviderService(fetchMock as unknown as typeof fetch);
    await service.create({
      providerCode: 'deepseek-main',
      providerName: 'DeepSeek',
      providerType: 'DEEPSEEK',
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-test',
    });

    const response = await service.testModelConfigPayload({
      modelName: 'DeepSeek Reasoner',
      providerCode: 'deepseek-main',
      modelId: 'deepseek-reasoner',
      modelType: 'LLM',
      parameters: { thinkingEnabled: false },
      capabilities: { stream: true, jsonMode: false, toolCalling: false, reasoning: true },
      limits: { contextWindow: 128000, maxOutputTokens: 4096 },
    });

    expect(response.status).toBe('SUCCESS');
    const lastCall = fetchMock.mock.calls.at(-1) as unknown as [unknown, RequestInit];
    const payload = JSON.parse(String(lastCall[1].body));
    expect(payload.request).toMatchObject({
      providerKind: 'DEEPSEEK',
      enableThinking: false,
    });
    expect(payload.request).not.toHaveProperty('providerOptions');
    expect(String(lastCall[1].body)).not.toContain('"thinking"');
  });

  it('rejects DeepSeek embedding models', async () => {
    const service = createProviderService();
    await service.create({
      providerCode: 'deepseek-main',
      providerName: 'DeepSeek',
      providerType: 'DEEPSEEK',
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-test',
    });

    await expect(
      service.createModel({
        modelName: 'DeepSeek Embedding',
        providerCode: 'deepseek-main',
        modelId: 'deepseek-embedding',
        modelType: 'EMBEDDING',
        ...embeddingModelConfig(),
      }),
    ).rejects.toThrow('DeepSeek 官方供应商暂不支持');
  });
});
