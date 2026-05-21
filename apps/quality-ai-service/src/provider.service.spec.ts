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
      defaultModel: 'deepseek-chat',
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
      defaultModel: 'deepseek-chat',
    });
    const secondProvider = await service.create({
      providerName: 'DeepSeek 生产环境',
      providerType: 'DEEPSEEK',
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-test',
      defaultModel: 'deepseek-chat',
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
      defaultModel: 'deepseek-chat',
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
        defaultModel: 'deepseek-chat',
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
      defaultModel: 'qwen-plus',
    });

    expect((await service.update('qwen-main', { defaultModel: 'qwen-max' })).defaultModel).toBe('qwen-max');
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
      defaultModel: 'quality-judge',
    });
    await service.createModel({
      modelCode: 'quality-judge',
      modelName: '质量评估模型',
      providerCode: 'openai-compatible-main',
      modelId: 'quality-judge',
      purpose: 'JUDGE',
      contextWindow: 128000,
      temperature: 0.2,
    });

    await expect(service.delete('openai-compatible-main')).rejects.toThrow('该供应商下仍有关联模型');
  });

  it('manages concrete models under a provider source', async () => {
    const fetchMock = createProviderFetch();
    const service = new ProviderService(fetchMock as unknown as typeof fetch);
    await service.create({
      providerCode: 'qwen-main',
      providerName: '通义千问',
      providerType: 'QWEN',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'sk-test',
      defaultModel: 'qwen-plus',
    });

    const created = await service.createModel({
      modelCode: 'qwen-plus-eval',
      modelName: 'Qwen Plus 评估模型',
      providerCode: 'qwen-main',
      modelId: 'qwen-plus',
      purpose: 'JUDGE',
      contextWindow: 128000,
      temperature: 0.2,
    });

    expect(created.enabled).toBe(true);
    expect((await service.modelList({ providerCode: 'qwen-main' }, { currentPage: 1, linesPerPage: 10 })).page.totalNum).toBe(1);
    expect(await service.testModelConnection('qwen-plus-eval')).toMatchObject({
      modelCode: 'qwen-plus-eval',
      status: 'SUCCESS',
    });
    expect((await service.updateModel('qwen-plus-eval', { temperature: 0.1 })).temperature).toBe(0.1);
    expect((await service.changeModelStatus('qwen-plus-eval', false)).enabled).toBe(false);
    expect((await service.deleteModel('qwen-plus-eval')).modelCode).toBe('qwen-plus-eval');
  });
});
