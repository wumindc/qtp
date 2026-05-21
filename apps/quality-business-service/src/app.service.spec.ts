import { describe, expect, it } from 'vitest';
import { AppService } from './app.service';

describe('AppService', () => {
  it('starts with no AI applications', async () => {
    const service = new AppService();

    const result = await service.list({}, { currentPage: 1, linesPerPage: 10 });

    expect(result.list).toHaveLength(0);
    expect(result.page.totalNum).toBe(0);
  });

  it('creates and disables an AI application', async () => {
    const service = new AppService();
    const created = await service.create({
      appCode: 'policy_match',
      appName: '政策匹配助手',
      appType: 'WORKFLOW',
      businessDomain: '政策服务',
      invokeUrl: 'http://example.com/policy',
      owner: 'tester',
    });

    expect(created.appCode).toBe('policy_match');

    const disabled = await service.changeStatus('policy_match', 'DISABLED');
    expect(disabled.status).toBe('DISABLED');
  });

  it('updates and deletes an AI application', async () => {
    const service = new AppService();
    await service.create({
      appCode: 'delete_me',
      appName: '临时应用',
      appType: 'CHAT',
      businessDomain: '质量验证',
      invokeUrl: 'http://example.com/chat',
    });

    const updated = await service.update('delete_me', { appName: '已更新应用', owner: 'qa' });
    expect(updated.appName).toBe('已更新应用');
    expect(updated.owner).toBe('qa');

    expect((await service.delete('delete_me')).appCode).toBe('delete_me');
    expect((await service.list({ keyword: '已更新' }, { currentPage: 1, linesPerPage: 10 })).page.totalNum).toBe(0);
  });

  it('saves protocol configuration and returns deterministic test result', async () => {
    const fetchMock = async () =>
      ({
        ok: true,
        text: async () => JSON.stringify({ success: true, data: { answer: '协议回答：信用修复' } }),
      }) as Response;
    const service = new AppService(fetchMock as typeof fetch);
    await service.create({
      appCode: 'credit_assistant',
      appName: '信用服务助手',
      appType: 'CHATBOT',
      businessDomain: '信用服务',
      invokeUrl: 'http://127.0.0.1:3104/search.do',
    });

    const saved = await service.saveProtocol('credit_assistant', {
      requestMethod: 'GET',
      invokeUrl: 'http://127.0.0.1:3104/search.do',
      authType: 'API_KEY',
      headerTemplate: '{\n  "X-Api-Key": "{{secret.apiKey}}"\n}',
      bodyTemplate: '{\n  "query": "{{case.query}}"\n}',
      answerPath: '$.data.answer',
      successExpression: '$.success == true',
      streamEnabled: true,
    });

    expect(saved.requestMethod).toBe('GET');
    expect(saved.answerPath).toBe('$.data.answer');
    expect((await service.protocolDetail('credit_assistant')).invokeUrl).toContain('/search.do');
    await expect(service.testProtocol('credit_assistant', { query: '信用修复' })).resolves.toMatchObject({
      success: true,
      appCode: 'credit_assistant',
      requestMethod: 'GET',
      resolvedBody: '{\n  "query": "信用修复"\n}',
      parsedAnswer: '协议回答：信用修复',
      message: '协议真实调用通过',
    });
  });
});
