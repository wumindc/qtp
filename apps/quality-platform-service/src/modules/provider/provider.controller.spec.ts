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

    expect(response.success).toBe(true);
    expect(response.data.list).toHaveLength(0);
    expect(response.data.page.totalNum).toBe(0);
  });

  it('lists and tests concrete model configurations after creation', async () => {
    const service = new ProviderService(createProviderFetch() as unknown as typeof fetch);
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
        })
      ).data.status,
    ).toBe('SUCCESS');
  });

  it('tests unsaved provider configuration from the form', async () => {
    const controller = new ProviderController(new ProviderService(createProviderFetch() as unknown as typeof fetch));

    const response = await controller.testConfig({
      providerType: 'OPENAI_COMPATIBLE',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test',
    });

    expect(response).toMatchObject({
      success: true,
      data: {
        endpoint: 'https://api.example.com/v1/models',
        status: 'SUCCESS',
      },
    });
  });
});
