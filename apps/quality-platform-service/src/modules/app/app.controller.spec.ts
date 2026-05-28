import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppController } from './app.controller';
import {
  AppService,
  type AppDataStore,
  type AppRecord,
  type AppStats,
  type StoredAppEvaluationConfig,
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
    list: async () => Array.from(apps.values()).map(cloneAppRecord),
    statsByAppCode: async (appCodes) => {
      const pairs: Array<[string, AppStats]> = [];
      for (const appCode of appCodes) {
        const appStats = stats.get(appCode) ?? apps.get(appCode)?.stats;
        if (appStats) pairs.push([appCode, { ...appStats }]);
      }
      return new Map(pairs);
    },
    find: async (appCode) => {
      const app = apps.get(appCode);
      return app ? cloneAppRecord(app) : null;
    },
    create: async (record) => {
      const next = cloneAppRecord(record);
      apps.set(next.appCode, next);
      return cloneAppRecord(next);
    },
    update: async (record) => {
      if (!apps.has(record.appCode)) throw new Error('应用不存在');
      const next = cloneAppRecord(record);
      apps.set(next.appCode, next);
      return cloneAppRecord(next);
    },
    delete: async (appCode) => {
      const app = apps.get(appCode);
      if (!app) throw new Error('应用不存在');
      apps.delete(appCode);
      return cloneAppRecord(app);
    },
    findEvaluationConfig: async (appCode) => {
      const config = evaluationConfigs.get(appCode);
      return config ? { ...config } : null;
    },
    saveEvaluationConfig: async (record) => {
      const next = { ...record };
      evaluationConfigs.set(record.appCode, next);
      return { ...next };
    },
  };
}

function createAppService(fetchImpl: typeof fetch = fetch, dataStore: AppDataStore = createAppDataStore()) {
  return new AppService(fetchImpl, dataStore);
}

describe('AppController', () => {
  it('does not synthesize missing request objects as empty objects', () => {
    const source = readFileSync(join(process.cwd(), 'src/modules/app/app.controller.ts'), 'utf8');

    expect(source).not.toContain('request.data ?? {}');
    expect(source).not.toContain('request.sampleInput ?? {}');
  });

  it('wraps empty list responses in the platform response envelope', async () => {
    const controller = new AppController(createAppService());

    const response = await controller.list({
      page: { currentPage: 1, linesPerPage: 10 },
      data: {},
    });

    expect(response.success).toBe(true);
    expect(response.data.list).toHaveLength(0);
    expect(response.data.page.currentPage).toBe(1);
  });

  it('rejects list requests missing query data instead of silently using an empty query', async () => {
    const controller = new AppController(createAppService());

    await expect(
      controller.list({
        page: { currentPage: 1, linesPerPage: 10 },
      } as Parameters<AppController['list']>[0]),
    ).rejects.toThrow('缺少应用查询条件');
  });

  it('wraps single app detail responses in the platform response envelope', async () => {
    const service = createAppService();
    await service.create({
      appCode: 'workspace_app',
      appName: '工作区应用',
      appType: 'CHAT',
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
    const service = createAppService(fetchMock as typeof fetch);
    await service.create({
      appCode: 'credit_assistant',
      appName: '信用服务助手',
      appType: 'CHAT',
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

  it('rejects protocol tests missing sample input instead of sending an empty request body', async () => {
    const service = createAppService();
    await service.create({
      appCode: 'credit_assistant',
      appName: '信用服务助手',
      appType: 'CHAT',
      invokeUrl: 'http://127.0.0.1:3104/custom.do',
    });
    const controller = new AppController(service);

    await expect(
      controller.protocolTest({
        appCode: 'credit_assistant',
      } as Parameters<AppController['protocolTest']>[0]),
    ).rejects.toThrow('缺少协议测试输入');
  });

  it('wraps application evaluation config endpoints in the platform response envelope', async () => {
    const service = createAppService();
    await service.create({
      appCode: 'credit_assistant',
      appName: '信用服务助手',
      appType: 'CHAT',
      invokeUrl: 'http://127.0.0.1:3104/custom.do',
    });
    const controller = new AppController(service);

    const initial = await controller.evaluationConfigDetail({ appCode: 'credit_assistant' });

    expect(initial.success).toBe(true);
    expect(initial.data.systemPrompt).toContain('AI 应用质量评估裁判');
    expect(initial.data.configured).toBe(false);

    const saved = await controller.evaluationConfigSave({
      appCode: 'credit_assistant',
      data: {
        modelId: '4',
        promptOverrideEnabled: true,
        customPrompt: '应用级裁判提示词',
      },
    });

    expect(saved.success).toBe(true);
    expect(saved.data).toMatchObject({
      configured: true,
      modelId: '4',
      effectivePrompt: '应用级裁判提示词',
    });
  });
});
