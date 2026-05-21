import { describe, expect, it, vi } from 'vitest';
import { ProviderController } from './provider.controller';
import { ProviderService } from './provider.service';

function createProviderFetch() {
  return vi.fn(async () => new Response('{}', { status: 200 }));
}

describe('ProviderController', () => {
  it('lists model providers from an empty service', async () => {
    const controller = new ProviderController(new ProviderService());

    const response = await controller.list({
      page: { currentPage: 1, linesPerPage: 10 },
      data: {},
    });

    expect(response.list).toHaveLength(0);
    expect(response.page.totalNum).toBe(0);
  });

  it('lists and tests concrete model configurations after creation', async () => {
    const service = new ProviderService(createProviderFetch() as unknown as typeof fetch);
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
    const controller = new ProviderController(service);

    const response = await controller.modelList({
      page: { currentPage: 1, linesPerPage: 10 },
      data: { purpose: 'JUDGE' },
    });

    expect(response.list[0]?.modelCode).toBe('quality-judge');
    expect((await controller.testModelConnection({ modelCode: 'quality-judge' })).status).toBe('SUCCESS');
  });

  it('tests unsaved provider configuration from the form', async () => {
    const controller = new ProviderController(new ProviderService(createProviderFetch() as unknown as typeof fetch));

    const response = await controller.testConfig({
      providerType: 'OPENAI_COMPATIBLE',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test',
    });

    expect(response).toMatchObject({
      endpoint: 'https://api.example.com/v1/models',
      status: 'SUCCESS',
    });
  });
});
