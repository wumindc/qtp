import { describe, expect, it, vi } from 'vitest';
import { AppService, type CreateAppRequest } from './app.service';

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
    expect(created.icon).toMatchObject({
      iconKey: expect.any(String),
      themeKey: expect.any(String),
      variantKey: expect.any(String),
    });

    const disabled = await service.changeStatus('policy_match', 'DISABLED');
    expect(disabled.status).toBe('DISABLED');
    expect(disabled.icon).toEqual(created.icon);
  });

  it('creates an AI application from the simplified form payload', async () => {
    const service = new AppService();

    const created = await service.create({
      appName: '网站对话助手',
      appType: 'CHAT',
      owner: '吴敏',
    } as CreateAppRequest);

    expect(created.appCode).toMatch(/^app-[a-z0-9]+/u);
    expect(created.businessDomain).toBe('未分类');
    expect(created.invokeUrl).toBe('');
    expect(created.owner).toBe('吴敏');
    expect(created.icon).toMatchObject({
      iconKey: expect.any(String),
      themeKey: expect.any(String),
      variantKey: expect.any(String),
    });
  });

  it('returns a single AI application by code for workspace detail pages', async () => {
    const service = new AppService();
    await service.create({
      appCode: 'workspace_app',
      appName: '工作区应用',
      appType: 'CHATBOT',
      businessDomain: '应用工作台',
      invokeUrl: 'http://example.com/workspace',
      owner: 'workspace-owner',
    });

    await expect(service.detail('workspace_app')).resolves.toMatchObject({
      appCode: 'workspace_app',
      appName: '工作区应用',
      owner: 'workspace-owner',
    });
    await expect(service.detail('missing_app')).rejects.toThrow('应用不存在');
  });

  it('enriches list apps with protocol fields and aggregate stats', async () => {
    const service = new AppService();
    (service as unknown as { database: unknown }).database = {
      list: vi.fn().mockResolvedValue([
        {
          appCode: 'c',
          appName: '北京信用小京灵',
          appType: 'CHAT',
          businessDomain: '信用',
          invokeUrl: 'http://example.com/chat.do',
          owner: 'qa',
          status: 'ENABLED',
          requestMethod: 'POST',
          authType: 'NONE',
          headerTemplate: '{"Content-Type":"application/json"}',
          bodyTemplate: '{"query":"{{case.input.query}}"}',
          requestSchema: '{}',
          responseSchema: '{}',
          streamEnabled: false,
          adapterConfig: { response: { answerPath: '$.content', successExpression: '$.code == 0' } },
        },
      ]),
      statsByAppCode: vi.fn().mockResolvedValue(new Map([
        ['c', {
          caseCount: 5,
          planCount: 3,
          lastRunAt: '2026-05-26T10:36:50.028Z',
          lastPassRate: 80,
        }],
      ])),
    };

    const result = await service.list({}, { currentPage: 1, linesPerPage: 10 });

    expect(result.list[0]).toMatchObject({
      appCode: 'c',
      invokeUrl: 'http://example.com/chat.do',
      requestMethod: 'POST',
      stats: {
        caseCount: 5,
        planCount: 3,
        lastPassRate: 80,
      },
    });
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
    const iconBeforeSave = (await service.detail('credit_assistant')).icon;

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
    expect((await service.detail('credit_assistant')).icon).toEqual(iconBeforeSave);
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

  it('returns the system judge prompt and saves an application evaluation override', async () => {
    const service = new AppService();
    await service.create({
      appCode: 'credit_assistant',
      appName: '信用服务助手',
      appType: 'CHATBOT',
      businessDomain: '信用服务',
      invokeUrl: 'http://127.0.0.1:3104/search.do',
    });

    const initial = await service.evaluationConfigDetail('credit_assistant');

    expect(initial.configured).toBe(false);
    expect(initial.modelId).toBe('');
    expect(initial.systemPrompt).toContain('AI 应用质量评估裁判');
    expect(initial.effectivePrompt).toBe(initial.systemPrompt);

    const saved = await service.saveEvaluationConfig('credit_assistant', {
      modelId: '4',
      promptOverrideEnabled: true,
      customPrompt: '请严格判断回答是否符合期望。',
    });

    expect(saved.configured).toBe(true);
    expect(saved.modelId).toBe('4');
    expect(saved.promptOverrideEnabled).toBe(true);
    expect(saved.effectivePrompt).toBe('请严格判断回答是否符合期望。');
    await expect(service.evaluationConfigDetail('credit_assistant')).resolves.toMatchObject({
      configured: true,
      modelId: '4',
      customPrompt: '请严格判断回答是否符合期望。',
    });
  });
});
