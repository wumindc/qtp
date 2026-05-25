import { describe, expect, it } from 'vitest';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  it('wraps empty list responses in the platform response envelope', async () => {
    const controller = new AppController(new AppService());

    const response = await controller.list({
      page: { currentPage: 1, linesPerPage: 10 },
      data: {},
    });

    expect(response.success).toBe(true);
    expect(response.data.list).toHaveLength(0);
    expect(response.data.page.currentPage).toBe(1);
  });

  it('wraps single app detail responses in the platform response envelope', async () => {
    const service = new AppService();
    await service.create({
      appCode: 'workspace_app',
      appName: '工作区应用',
      appType: 'CHATBOT',
      businessDomain: '应用工作台',
      invokeUrl: 'http://example.com/workspace',
    });
    const controller = new AppController(service);

    const response = await controller.detail({ appCode: 'workspace_app' });

    expect(response.success).toBe(true);
    expect(response.data.appCode).toBe('workspace_app');
  });

  it('exposes protocol detail, save, and test endpoints', async () => {
    const fetchMock = async () =>
      ({
        ok: true,
        text: async () => JSON.stringify({ code: 0, answer: '协议调试通过' }),
      }) as Response;
    const service = new AppService(fetchMock as typeof fetch);
    await service.create({
      appCode: 'credit_assistant',
      appName: '信用服务助手',
      appType: 'CHATBOT',
      businessDomain: '信用服务',
      invokeUrl: 'http://127.0.0.1:3104/custom.do',
    });
    const controller = new AppController(service);

    const saved = await controller.protocolSave({
      appCode: 'credit_assistant',
      data: {
        requestMethod: 'POST',
        invokeUrl: 'http://127.0.0.1:3104/custom.do',
        answerPath: '$.answer',
      },
    });

    expect(saved.data.answerPath).toBe('$.answer');
    expect((await controller.protocolDetail({ appCode: 'credit_assistant' })).data.invokeUrl).toContain('/custom.do');
    await expect(controller.protocolTest({ appCode: 'credit_assistant', sampleInput: { query: '测试' } })).resolves.toMatchObject({
      data: { success: true, parsedAnswer: '协议调试通过' },
    });
  });
});
