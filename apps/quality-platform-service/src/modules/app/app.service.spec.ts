import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AppService,
  type AppDataStore,
  type AppProtocolSaveRequest,
  type AppRecord,
  type AppStats,
  type CreateAppRequest,
  type StoredAppEvaluationConfig,
  type UpdateAppRequest,
} from './app.service';

function cloneAppRecord(record: AppRecord): AppRecord {
  return {
    ...record,
    adapterConfig: {
      response: { ...record.adapterConfig.response },
      ...(record.adapterConfig.execution ? { execution: { ...record.adapterConfig.execution } } : {}),
    },
    ...(record.icon ? { icon: { ...record.icon } } : {}),
    ...(record.stats ? { stats: { ...record.stats } } : {}),
  };
}

function createAppDataStore(initialApps: AppRecord[] = [], stats = new Map<string, AppStats>()): AppDataStore {
  const apps = new Map(initialApps.map((app) => [app.appCode, cloneAppRecord(app)]));
  const evaluationConfigs = new Map<string, StoredAppEvaluationConfig>();
  return {
    list: vi.fn(async () => Array.from(apps.values()).map(cloneAppRecord)),
    statsByAppCode: vi.fn(async (appCodes) => {
      const pairs: Array<[string, AppStats]> = [];
      for (const appCode of appCodes) {
        const appStats = stats.get(appCode) ?? apps.get(appCode)?.stats;
        if (appStats) pairs.push([appCode, { ...appStats }]);
      }
      return new Map(pairs);
    }),
    find: vi.fn(async (appCode) => {
      const app = apps.get(appCode);
      return app ? cloneAppRecord(app) : null;
    }),
    create: vi.fn(async (record) => {
      const next = cloneAppRecord(record);
      apps.set(next.appCode, next);
      return cloneAppRecord(next);
    }),
    update: vi.fn(async (record) => {
      if (!apps.has(record.appCode)) throw new Error('应用不存在');
      const next = cloneAppRecord(record);
      apps.set(next.appCode, next);
      return cloneAppRecord(next);
    }),
    delete: vi.fn(async (appCode) => {
      const app = apps.get(appCode);
      if (!app) throw new Error('应用不存在');
      apps.delete(appCode);
      return cloneAppRecord(app);
    }),
    findEvaluationConfig: vi.fn(async (appCode) => {
      const config = evaluationConfigs.get(appCode);
      return config ? { ...config } : null;
    }),
    saveEvaluationConfig: vi.fn(async (record) => {
      const next = { ...record };
      evaluationConfigs.set(record.appCode, next);
      return { ...next };
    }),
  };
}

function createAppService(fetchImpl: typeof fetch = fetch, dataStore: AppDataStore = createAppDataStore()) {
  return new AppService(fetchImpl, dataStore);
}

describe('AppService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not keep a production in-memory fallback store', () => {
    const source = readFileSync(join(process.cwd(), 'src/modules/app/app.service.ts'), 'utf8');

    expect(source).not.toContain('process.env.VITEST');
    expect(source).not.toContain('private readonly apps = new Map');
    expect(source).not.toContain('private readonly evaluationConfigs = new Map');
    expect(source).not.toContain('saved ?? record');
  });

  it('does not generate application codes from timestamp suffixes', () => {
    const source = readFileSync(join(process.cwd(), 'src/modules/app/app.service.ts'), 'utf8');

    expect(source).not.toContain('Date.now().toString(36)');
    expect(source).not.toContain('Math.random()');
  });

  /**
   * @author codex
   * @author Antigravity/Claude-Sonnet-4.6
   * 应用协议字段（templates/response/execution）允许缺失并回退到默认值，
   * 以支持旧格式数据库记录不阻断应用列表加载（用户可进入详情页补全）。
   * 但核心标识字段（appCode/appName/status）和评估配置字段仍禁止用 String()/强转兜底。
   */
  it('does not default malformed persisted app protocol records during database mapping', () => {
    const source = readFileSync(join(process.cwd(), 'src/modules/app/app.service.ts'), 'utf8');

    // 核心标识字段和评估字段严格禁止用 String()/强转兜底
    expect(source).not.toContain('const appCode = String(data.appCode)');
    expect(source).not.toContain('const appName = String(data.appName)');
    expect(source).not.toContain('invokeUrl: String(data.invokeUrl ?? \'\')');
    expect(source).not.toContain("status: data.status === 'DISABLED' ? 'DISABLED' : 'ENABLED'");
    expect(source).not.toContain('appCode: String(data.appCode)');
    expect(source).not.toContain('modelId: String(data.modelId ?? \'\')');
    expect(source).not.toContain('promptOverrideEnabled: data.promptOverrideEnabled === true');
    expect(source).not.toContain('customPrompt: typeof data.customPrompt === \'string\' ? data.customPrompt : \'\'');
    expect(source).not.toContain('evaluationConcurrency: this.normalizeConcurrency(data.evaluationConcurrency)');
  });


  it('does not hide malformed application statistics source rows', () => {
    const source = readFileSync(join(process.cwd(), 'src/modules/app/app.service.ts'), 'utf8');

    expect(source).not.toContain('subscriptions.map((subscription) => this.toBigInt(subscription.categoryId)).filter');
    expect(source).not.toContain('const latestRun = this.asRecord(latestRuns[0])');
    expect(source).not.toContain('Number(latestRun.totalCount ?? 0)');
    expect(source).not.toContain('Number(latestRun.passCount ?? 0)');
    expect(source).not.toContain('this.toIsoString(latestRun.startedAt)');
  });

  it('does not synthesize stable icons for persisted applications missing icon config', async () => {
    const source = readFileSync(join(process.cwd(), 'src/modules/app/app.service.ts'), 'utf8');
    expect(source).not.toContain('createStableAppIconConfig');

    const service = createAppService(fetch, createAppDataStore([
      {
        appCode: 'missing_icon',
        appName: '缺图标应用',
        appType: 'CHAT',
        invokeUrl: 'http://example.com/chat.do',
        requestMethod: 'POST',
        owner: undefined,
        status: 'ENABLED',
        headerTemplate: '{"Content-Type":"application/json"}',
        bodyTemplate: '{"query":"{{case.input.query}}"}',
        streamEnabled: false,
        adapterConfig: {
          response: { answerPath: '$.content', successExpression: '$.code == 0' },
          execution: { appConcurrency: 3 },
        },
      } as AppRecord,
    ]));

    await expect(service.list({}, { currentPage: 1, linesPerPage: 10 })).rejects.toThrow('应用记录缺少图标配置');
  });

  it('starts with no AI applications', async () => {
    const service = createAppService();

    const result = await service.list({}, { currentPage: 1, linesPerPage: 10 });

    expect(result.list).toHaveLength(0);
    expect(result.page.totalNum).toBe(0);
  });

  it('creates and disables an AI application', async () => {
    const service = createAppService();
    const created = await service.create({
      appCode: 'policy_match',
      appName: '政策匹配助手',
      appType: 'CHAT',
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
    const service = createAppService();

    const created = await service.create({
      appName: '网站对话助手',
      appType: 'CHAT',
      owner: '吴敏',
    } as CreateAppRequest);

    expect(created.appCode).toMatch(/^app-[a-z0-9]+/u);
    expect(created).not.toHaveProperty('businessDomain');
    expect(created.invokeUrl).toBe('');
    expect(created.owner).toBe('吴敏');
    expect(created.icon).toMatchObject({
      iconKey: expect.any(String),
      themeKey: expect.any(String),
      variantKey: expect.any(String),
    });
  });

  it('does not invent a system owner when the application owner is blank', async () => {
    const service = createAppService();

    const created = await service.create({
      appName: '无负责人应用',
      appType: 'CHAT',
      owner: '   ',
    } as CreateAppRequest);

    expect(created.owner).toBeUndefined();
    expect(JSON.stringify(created)).not.toContain('system');
  });

  it('rejects unsupported application types instead of accepting old or undeployed values', async () => {
    const service = createAppService();
    const baseRequest = {
      appName: '旧类型应用',
      invokeUrl: 'http://example.com/chat',
    };

    await expect(service.create({ ...baseRequest, appType: 'CHATBOT' })).rejects.toThrow('当前仅支持 CHAT 类型应用');
    await expect(service.create({ ...baseRequest, appType: 'WORKFLOW' })).rejects.toThrow('当前仅支持 CHAT 类型应用');
  });

  it('returns a single AI application by code for workspace detail pages', async () => {
    const service = createAppService();
    await service.create({
      appCode: 'workspace_app',
      appName: '工作区应用',
      appType: 'CHAT',
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

  it('enriches detail apps with aggregate stats used by overview pages', async () => {
    const service = createAppService(fetch, createAppDataStore([
      {
        appCode: 'overview_app',
        appName: '概览应用',
        appType: 'CHAT',
        description: '用于概览页统计',
        invokeUrl: 'http://example.com/chat.do',
        owner: 'qa',
        status: 'ENABLED',
        icon: { iconKey: 'brain', themeKey: 'emerald', variantKey: 'ring' },
        requestMethod: 'POST',
        headerTemplate: '{"Content-Type":"application/json"}',
        bodyTemplate: '{"query":"{{case.input.query}}"}',
        streamEnabled: false,
        adapterConfig: { response: { answerPath: '$.content', successExpression: '$.code == 0' } },
      },
    ], new Map([
      ['overview_app', {
        caseCount: 143,
        planCount: 1,
        lastRunAt: '2026-05-27T02:38:40.978Z',
        lastPassRate: 20,
      }],
    ])));

    await expect(service.detail('overview_app')).resolves.toMatchObject({
      appCode: 'overview_app',
      stats: {
        caseCount: 143,
        planCount: 1,
        lastPassRate: 20,
      },
    });
  });

  it('enriches list apps with protocol fields and aggregate stats', async () => {
    const service = createAppService(fetch, createAppDataStore([
      {
        appCode: 'c',
        appName: '北京信用小京灵',
        appType: 'CHAT',
        invokeUrl: 'http://example.com/chat.do',
        owner: 'qa',
        status: 'ENABLED',
        icon: { iconKey: 'brain', themeKey: 'emerald', variantKey: 'ring' },
        requestMethod: 'POST',
        headerTemplate: '{"Content-Type":"application/json"}',
        bodyTemplate: '{"query":"{{case.input.query}}"}',
        streamEnabled: false,
        adapterConfig: { response: { answerPath: '$.content', successExpression: '$.code == 0' } },
      },
    ], new Map([
      ['c', {
        caseCount: 5,
        planCount: 3,
        lastRunAt: '2026-05-26T10:36:50.028Z',
        lastPassRate: 80,
      }],
    ])));

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
    const service = createAppService();
    await service.create({
      appCode: 'delete_me',
      appName: '临时应用',
      appType: 'CHAT',
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
    const service = createAppService(fetchMock as typeof fetch);
    await service.create({
      appCode: 'credit_assistant',
      appName: '信用服务助手',
      appType: 'CHAT',
      invokeUrl: 'http://127.0.0.1:3104/search.do',
    });
    const iconBeforeSave = (await service.detail('credit_assistant')).icon;

    const saved = await service.saveProtocol('credit_assistant', {
      requestMethod: 'GET',
      invokeUrl: 'http://127.0.0.1:3104/search.do',
      headerTemplate: '{\n  "Content-Type": "application/json"\n}',
      bodyTemplate: '{\n  "query": "{{case.input.query}}"\n}',
      answerPath: '$.data.answer',
      successExpression: '$.success == true',
      streamEnabled: true,
      appConcurrency: 6,
    });

    expect(saved.requestMethod).toBe('GET');
    expect(saved.answerPath).toBe('$.data.answer');
    expect(saved.appConcurrency).toBe(6);
    expect((await service.detail('credit_assistant')).icon).toEqual(iconBeforeSave);
    expect(await service.protocolDetail('credit_assistant')).toMatchObject({
      invokeUrl: expect.stringContaining('/search.do'),
      appConcurrency: 6,
    });
    await expect(service.testProtocol('credit_assistant', { query: '信用修复' })).resolves.toMatchObject({
      success: true,
      appCode: 'credit_assistant',
      requestMethod: 'GET',
      resolvedBody: '{\n  "query": "信用修复"\n}',
      rawResponseText: JSON.stringify({ success: true, data: { answer: '协议回答：信用修复' } }),
      parsedAnswer: '协议回答：信用修复',
      message: '协议真实调用通过',
    });
  });

  it('rejects unsupported protocol request methods instead of defaulting to POST', async () => {
    const service = createAppService();
    await service.create({
      appCode: 'method_app',
      appName: '方法应用',
      appType: 'CHAT',
      invokeUrl: 'http://127.0.0.1:3104/search.do',
    });

    await expect(service.saveProtocol('method_app', {
      requestMethod: 'PATCH' as never,
    })).rejects.toThrow('当前仅支持 GET/POST 请求方法');

    await expect(service.testProtocol('method_app', { query: '信用修复' }, {
      requestMethod: 'PUT' as never,
    })).rejects.toThrow('当前仅支持 GET/POST 请求方法');
  });

  it('renders only the canonical case.input protocol placeholder during protocol tests', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body ?? '{}')) as Record<string, unknown>;
      return new Response(JSON.stringify({ success: true, data: { answer: body } }), { status: 200 });
    });
    const service = createAppService(fetchMock as typeof fetch);
    await service.create({
      appCode: 'canonical_protocol_app',
      appName: '规范协议应用',
      appType: 'CHAT',
      invokeUrl: 'http://127.0.0.1:3104/search.do',
    });
    await service.saveProtocol('canonical_protocol_app', {
      invokeUrl: 'http://127.0.0.1:3104/search.do',
      bodyTemplate: '{"query":"{{case.input.query}}","legacy":"{{case.query}}"}',
      answerPath: '$.data.answer',
      successExpression: '$.success == true',
    });

    await expect(service.testProtocol('canonical_protocol_app', { query: '信用修复' })).resolves.toMatchObject({
      resolvedBody: '{"query":"信用修复","legacy":""}',
    });
  });

  it('rejects invalid request header JSON instead of testing with empty headers', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { answer: 'ok' } }), { status: 200 }));
    const service = createAppService(fetchMock as typeof fetch);
    await service.create({
      appCode: 'invalid_header_app',
      appName: '非法请求头应用',
      appType: 'CHAT',
      invokeUrl: 'http://127.0.0.1:3104/search.do',
    });

    await expect(service.testProtocol('invalid_header_app', { query: '信用修复' }, {
      headerTemplate: '{"Content-Type":"application/json"',
      bodyTemplate: '{"query":"{{case.input.query}}"}',
      answerPath: '$.data.answer',
      successExpression: '$.success == true',
    })).rejects.toThrow('请求头模板不是合法 JSON 对象');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects forbidden request headers in protocol tests', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { answer: 'ok' } }), { status: 200 }));
    const service = createAppService(fetchMock as typeof fetch);
    await service.create({
      appCode: 'forbidden_header_app',
      appName: '禁用请求头应用',
      appType: 'CHAT',
      invokeUrl: 'http://127.0.0.1:3104/search.do',
    });

    await expect(service.testProtocol('forbidden_header_app', { query: '信用修复' }, {
      headerTemplate: '{"Connection":"keep-alive","Content-Type":"application/json"}',
    })).rejects.toThrow('请求头模板包含禁用请求头：Connection');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects invalid request body JSON before protocol testing', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { answer: 'ok' } }), { status: 200 }));
    const service = createAppService(fetchMock as typeof fetch);
    await service.create({
      appCode: 'invalid_body_app',
      appName: '非法请求体应用',
      appType: 'CHAT',
      invokeUrl: 'http://127.0.0.1:3104/search.do',
    });

    await expect(service.testProtocol('invalid_body_app', { query: '信用修复' }, {
      headerTemplate: '{"Content-Type":"application/json"}',
      bodyTemplate: '{"query":"{{case.input.query}}"',
      answerPath: '$.data.answer',
      successExpression: '$.success == true',
    })).rejects.toThrow('请求体模板不是合法 JSON 对象');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects non-stream protocol responses that are not JSON objects', async () => {
    const fetchMock = vi.fn(async () =>
      new Response('plain text answer', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const service = createAppService(fetchMock as typeof fetch);
    await service.create({
      appCode: 'invalid_response_app',
      appName: '非法响应应用',
      appType: 'CHAT',
      invokeUrl: 'http://127.0.0.1:3104/search.do',
    });

    await expect(service.testProtocol('invalid_response_app', { query: '信用修复' }, {
      headerTemplate: '{"Content-Type":"application/json"}',
      bodyTemplate: '{"query":"{{case.input.query}}"}',
      answerPath: '$.data.answer',
      successExpression: '',
      streamEnabled: false,
    })).rejects.toThrow('应用响应不是合法 JSON 对象');
  });

  it('keeps hidden auth configuration out of application protocol contracts', async () => {
    const service = createAppService();
    await service.create({
      appCode: 'header_only_auth_app',
      appName: '请求头鉴权应用',
      appType: 'CHAT',
      invokeUrl: 'http://127.0.0.1:3104/search.do',
      authType: 'API_KEY',
      authConfig: { headerName: 'X-Internal-Key', apiKey: 'secret-from-hidden-config' },
      headerTemplate: '{"Content-Type":"application/json"}',
    } as CreateAppRequest & Record<string, unknown>);

    const detail = await service.protocolDetail('header_only_auth_app') as unknown as Record<string, unknown>;
    expect(detail).not.toHaveProperty('authType');
    expect(detail).not.toHaveProperty('authConfig');

    const saved = await service.saveProtocol('header_only_auth_app', {
      authType: 'BEARER_TOKEN',
      authConfig: { token: 'hidden-token' },
    } as AppProtocolSaveRequest & Record<string, unknown>) as unknown as Record<string, unknown>;
    expect(saved).not.toHaveProperty('authType');
    expect(saved).not.toHaveProperty('authConfig');
  });

  it('keeps deprecated protocol schema metadata out of application and protocol responses', async () => {
    const service = createAppService();
    const created = await service.create({
      appCode: 'schema_free_app',
      appName: '无协议 Schema 应用',
      appType: 'CHAT',
      invokeUrl: 'http://example.com/chat.do',
      requestSchema: '{"query":"string"}',
      responseSchema: '{"answer":"string"}',
    } as CreateAppRequest & Record<string, unknown>);

    expect(created).not.toHaveProperty('requestSchema');
    expect(created).not.toHaveProperty('responseSchema');

    const updated = await service.update('schema_free_app', {
      owner: 'qa',
      requestSchema: '{"legacy":true}',
      responseSchema: '{"legacy":true}',
    } as UpdateAppRequest & Record<string, unknown>);

    expect(updated).not.toHaveProperty('requestSchema');
    expect(updated).not.toHaveProperty('responseSchema');

    const saved = await service.saveProtocol('schema_free_app', {
      answerPath: '$.answer',
      requestSchema: '{"legacy":true}',
      responseSchema: '{"legacy":true}',
    } as AppProtocolSaveRequest & Record<string, unknown>);

    expect(saved).not.toHaveProperty('requestSchema');
    expect(saved).not.toHaveProperty('responseSchema');

    const detail = await service.protocolDetail('schema_free_app');
    expect(detail).not.toHaveProperty('requestSchema');
    expect(detail).not.toHaveProperty('responseSchema');
  });

  it('tests unsaved protocol input through the backend service without the frontend proxy route', async () => {
    const fetchMock = vi.fn(async (_url, init) =>
      ({
        ok: true,
        headers: new Headers({ 'Content-Type': 'text/event-stream' }),
        text: async () => 'data: {"delta":{"content":"协议"}}\n\ndata: {"delta":{"content":"回答"}}\n\ndata: [DONE]\n\n',
        requestBody: init?.body,
      }) as unknown as Response,
    );
    const service = createAppService(fetchMock as typeof fetch);
    await service.create({
      appCode: 'stream_app',
      appName: '流式应用',
      appType: 'CHAT',
      invokeUrl: 'http://example.com/old.do',
    });

    await expect(service.testProtocol('stream_app', { query: '信用修复' }, {
      requestMethod: 'POST',
      invokeUrl: 'http://example.com/new.do',
      headerTemplate: '{"Content-Type":"application/json"}',
      bodyTemplate: '{"query":"{{case.input.query}}"}',
      answerPath: '$.delta.content',
      successExpression: '',
      streamEnabled: true,
    })).resolves.toMatchObject({
      success: true,
      invokeUrl: 'http://example.com/new.do',
      resolvedBody: '{"query":"信用修复"}',
      parsedAnswer: '协议回答',
    });
    expect(fetchMock).toHaveBeenCalledWith('http://example.com/new.do', expect.any(Object));
  });

  it('does not treat unsupported success expressions as passing protocol tests', async () => {
    const fetchMock = vi.fn(async () =>
      ({
        ok: true,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: async () => JSON.stringify({ code: 1, content: '接口回答' }),
      }) as unknown as Response,
    );
    const service = createAppService(fetchMock as typeof fetch);
    await service.create({
      appCode: 'invalid_success_expr_app',
      appName: '非法成功表达式应用',
      appType: 'CHAT',
      invokeUrl: 'http://example.com/chat.do',
    });

    await expect(service.testProtocol('invalid_success_expr_app', { query: '信用修复' }, {
      successExpression: '$.code > 0',
    })).resolves.toMatchObject({
      success: false,
      assertion: '$.code > 0',
      parsedAnswer: '接口回答',
    });
  });

  it('rejects production protocol tests that target localhost application URLs', async () => {
    const fetchMock = vi.fn();
    const service = createAppService(fetchMock as typeof fetch);
    await service.create({
      appCode: 'local_app',
      appName: '本机临时应用',
      appType: 'CHAT',
      invokeUrl: 'http://127.0.0.1:3104/search.do',
    });
    vi.stubEnv('NODE_ENV', 'production');

    await expect(service.testProtocol('local_app', { query: '信用修复' })).rejects.toThrow(
      '被测应用调用地址不允许访问',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the system judge prompt and saves an application evaluation override', async () => {
    const service = createAppService();
    await service.create({
      appCode: 'credit_assistant',
      appName: '信用服务助手',
      appType: 'CHAT',
      invokeUrl: 'http://127.0.0.1:3104/search.do',
    });

    const initial = await service.evaluationConfigDetail('credit_assistant');

    expect(initial.configured).toBe(false);
    expect(initial.modelId).toBe('');
    expect(initial.evaluationConcurrency).toBe(3);
    expect(initial.systemPrompt).toContain('AI 应用质量评估裁判');
    expect(initial.effectivePrompt).toBe(initial.systemPrompt);

    const saved = await service.saveEvaluationConfig('credit_assistant', {
      modelId: '4',
      promptOverrideEnabled: true,
      customPrompt: '请严格判断回答是否符合期望。',
      evaluationConcurrency: 5,
    });

    expect(saved.configured).toBe(true);
    expect(saved.modelId).toBe('4');
    expect(saved.promptOverrideEnabled).toBe(true);
    expect(saved.evaluationConcurrency).toBe(5);
    expect(saved.effectivePrompt).toBe('请严格判断回答是否符合期望。');
    await expect(service.evaluationConfigDetail('credit_assistant')).resolves.toMatchObject({
      configured: true,
      modelId: '4',
      customPrompt: '请严格判断回答是否符合期望。',
      evaluationConcurrency: 5,
    });
  });

  it('clamps protocol and evaluation concurrency into the supported range', async () => {
    const service = createAppService();
    await service.create({
      appCode: 'concurrency_app',
      appName: '并发应用',
      appType: 'CHAT',
      invokeUrl: 'http://127.0.0.1:3104/search.do',
    });

    await expect(service.saveProtocol('concurrency_app', { appConcurrency: 999 })).resolves.toMatchObject({
      appConcurrency: 10,
    });
    await expect(service.saveEvaluationConfig('concurrency_app', {
      modelId: '4',
      evaluationConcurrency: 0,
    })).resolves.toMatchObject({
      evaluationConcurrency: 1,
    });
  });
});
