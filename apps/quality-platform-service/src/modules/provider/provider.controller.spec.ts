import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ProviderController } from './provider.controller';
import { ProviderService, type ModelRecord, type ProviderDataStore, type ProviderRecord } from './provider.service';

function createProviderFetch() {
  return vi.fn(async (url) => {
    const body = String(url).endsWith('/model/chat/invoke.do')
      ? JSON.stringify({ success: true, data: { status: 'SUCCEEDED', content: 'pong', elapsedMs: 1 } })
      : String(url).endsWith('/model/models/list.do')
        ? JSON.stringify({ success: true, data: { status: 'SUCCEEDED', responseJson: { data: [] }, elapsedMs: 1 } })
        : '{}';
    return new Response(body, { status: 200 });
  });
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

function createProviderService(fetchImpl: typeof fetch = createProviderFetch() as unknown as typeof fetch) {
  return new ProviderService(fetchImpl, createProviderDataStore());
}

function llmModelConfig() {
  return {
    parameters: { maxOutputTokens: 4096 },
    capabilities: { stream: true, jsonMode: true, toolCalling: true },
    limits: { contextWindow: 128000, maxOutputTokens: 4096 },
  };
}

describe('ProviderController', () => {
  it('does not synthesize missing model query data as an empty object', () => {
    const source = readFileSync(join(process.cwd(), 'src/modules/provider/provider.controller.ts'), 'utf8');

    expect(source).not.toContain('request.data ?? {}');
  });

  it('lists model providers from an empty service', async () => {
    const controller = new ProviderController(createProviderService());

    const response = await controller.list({
      page: { currentPage: 1, linesPerPage: 10 },
      data: {},
    });

    expect(response.success).toBe(true);
    expect(response.data.list).toHaveLength(0);
    expect(response.data.page.totalNum).toBe(0);
  });

  it('rejects model list requests missing query data instead of silently using an empty query', async () => {
    const controller = new ProviderController(createProviderService());

    await expect(
      controller.modelList({
        page: { currentPage: 1, linesPerPage: 10 },
      } as Parameters<ProviderController['modelList']>[0]),
    ).rejects.toThrow('缺少模型查询条件');
  });

  it('lists and tests concrete model configurations after creation', async () => {
    const service = createProviderService(createProviderFetch() as unknown as typeof fetch);
    await service.create({
      providerCode: 'openai-compatible-main',
      providerName: 'OpenAI 兼容供应商',
      providerType: 'OPENAI_COMPATIBLE',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test',
    });
    const model = await service.createModel({
      modelName: '质量评估模型',
      providerCode: 'openai-compatible-main',
      modelId: 'quality-judge',
      modelType: 'LLM',
      ...llmModelConfig(),
    });
    const controller = new ProviderController(service);

    const response = await controller.modelList({
      page: { currentPage: 1, linesPerPage: 10 },
      data: { modelType: 'LLM' },
    });

    expect(response.data.list[0]?.id).toBe(model.id);
    expect((await controller.testModelConnection({ id: model.id })).data.status).toBe('SUCCESS');
    expect(
      (
        await controller.testModelConfig({
          modelName: '临时评估模型',
          providerCode: 'openai-compatible-main',
          modelId: 'quality-judge',
          modelType: 'LLM',
          ...llmModelConfig(),
        })
      ).data.status,
    ).toBe('SUCCESS');
  });

  it('tests unsaved provider configuration from the form', async () => {
    const controller = new ProviderController(createProviderService(createProviderFetch() as unknown as typeof fetch));

    const response = await controller.testConfig({
      providerType: 'OPENAI_COMPATIBLE',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test',
    });

    expect(response).toMatchObject({
      success: true,
      data: {
        status: 'SUCCESS',
      },
    });
    expect(response.data).not.toHaveProperty('endpoint');
  });
});
