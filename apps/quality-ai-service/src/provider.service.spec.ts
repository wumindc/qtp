import { describe, expect, it, vi } from 'vitest';
import { ProviderService } from './provider.service';

function createProviderFetch(status = 200, body = '{}') {
  return vi.fn(async () => new Response(body, { status }));
}

describe('ProviderService', () => {
  it('contains the first supported provider types', () => {
    const service = new ProviderService();

    expect(service.supportedTypes()).toEqual(['OPENAI_COMPATIBLE', 'QWEN', 'DEEPSEEK']);
  });

  it('starts with no provider or model records', async () => {
    const service = new ProviderService();

    expect((await service.list({ currentPage: 1, linesPerPage: 10 })).page.totalNum).toBe(0);
    expect((await service.modelList({}, { currentPage: 1, linesPerPage: 10 })).page.totalNum).toBe(0);
  });

  it('creates and connection-tests a provider configuration', async () => {
    const fetchMock = createProviderFetch();
    const service = new ProviderService(fetchMock as unknown as typeof fetch);
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
      'https://api.deepseek.com/models',
      expect.objectContaining({
        headers: { Authorization: 'Bearer sk-test' },
        method: 'GET',
      }),
    );
  });

  it('generates internal provider codes when the UI does not submit one', async () => {
    const service = new ProviderService();

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

  it('tests transient provider config without requiring a saved provider', async () => {
    const fetchMock = createProviderFetch();
    const service = new ProviderService(fetchMock as unknown as typeof fetch);

    const response = await service.testConfig({
      providerType: 'QWEN',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'sk-test',
    });

    expect(response.status).toBe('SUCCESS');
    expect(response.endpoint).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/models');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('creates a disabled provider and rejects duplicate provider identifiers', async () => {
    const service = new ProviderService();
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
    const service = new ProviderService();
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

  it('blocks deleting a provider referenced by models', async () => {
    const service = new ProviderService();
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
    });

    await expect(service.delete('openai-compatible-main')).rejects.toThrow('该供应商下仍有关联模型');
  });

  it('manages LLM models under a provider source using database ids', async () => {
    const fetchMock = createProviderFetch();
    const service = new ProviderService(fetchMock as unknown as typeof fetch);
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
    });

    expect(created.enabled).toBe(true);
    expect(created.protocol).toBe('DASHSCOPE_COMPATIBLE_CHAT');
    expect(created.parameters.temperature).toBe(0.2);
    expect((await service.modelList({ providerCode: 'qwen-main', modelType: 'LLM' }, { currentPage: 1, linesPerPage: 10 })).page.totalNum).toBe(1);
    expect(await service.testModelConnection(created.id)).toMatchObject({
      id: created.id,
      status: 'SUCCESS',
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
    expect((await service.updateModel(created.id, { parameters: { temperature: 0.1 } })).parameters.temperature).toBe(0.1);
    expect((await service.changeModelStatus(created.id, false)).enabled).toBe(false);
    expect((await service.deleteModel(created.id)).id).toBe(created.id);
  });

  it('supports embedding model test payloads for compatible providers', async () => {
    const fetchMock = createProviderFetch();
    const service = new ProviderService(fetchMock as unknown as typeof fetch);
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
      parameters: { dimensions: 1024 },
    });

    expect(created.protocol).toBe('OPENAI_EMBEDDINGS');
    expect(created.capabilities.embedding).toBe(true);
    expect((await service.testModelConnection(created.id)).status).toBe('SUCCESS');
    expect(fetchMock).toHaveBeenLastCalledWith('https://api.example.com/v1/embeddings', expect.objectContaining({ method: 'POST' }));
  });

  it('rejects DeepSeek embedding models', async () => {
    const service = new ProviderService();
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
      }),
    ).rejects.toThrow('DeepSeek 官方供应商暂不支持');
  });
});
