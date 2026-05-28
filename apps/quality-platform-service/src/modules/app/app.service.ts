import { BadRequestException } from '@nestjs/common';
import {
  assertAllowedApplicationInvokeUrl,
  normalizeApplicationRequestHeaders,
} from '@ai-quality-platform/shared-config';
import { createRuntimePrismaClient } from '@ai-quality-platform/shared-database';
import { pageResult, type PageResult } from '@ai-quality-platform/shared-http';
import { randomBytes } from 'node:crypto';
import {
  createRandomAppIconConfig,
  normalizeAppIconConfig,
  type AppIconConfig,
} from './app-icon';

export interface AppRecord {
  appCode: string;
  appName: string;
  appType: AppType;
  description?: string;
  invokeUrl: string;
  owner?: string;
  status: 'ENABLED' | 'DISABLED';
  requestMethod: 'GET' | 'POST';
  headerTemplate: string;
  bodyTemplate: string;
  streamEnabled: boolean;
  adapterConfig: {
    response: {
      answerPath: string;
      successExpression: string;
    };
    execution?: {
      appConcurrency: number;
    };
  };
  stats?: AppStats;
  icon: AppIconConfig;
}

export interface AppStats {
  caseCount: number;
  planCount: number;
  lastRunAt?: string;
  lastPassRate?: number;
}

export interface AppQuery {
  keyword?: string;
}

export interface PageQuery {
  currentPage: number;
  linesPerPage: number;
}

export interface CreateAppRequest {
  appCode?: string;
  appName: string;
  appType?: string;
  description?: string;
  invokeUrl?: string;
  owner?: string;
  requestMethod?: AppRecord['requestMethod'];
  headerTemplate?: string;
  bodyTemplate?: string;
  answerPath?: string;
  successExpression?: string;
  streamEnabled?: boolean;
  appConcurrency?: number;
  icon?: Partial<AppIconConfig>;
}

export type AppType = 'CHAT';
export type UpdateAppRequest = Partial<Omit<AppRecord, 'appCode' | 'appType'>> & { appType?: string };

export interface AppProtocolDetail {
  appCode: string;
  appName: string;
  requestMethod: AppRecord['requestMethod'];
  invokeUrl: string;
  headerTemplate: string;
  bodyTemplate: string;
  answerPath: string;
  successExpression: string;
  streamEnabled: boolean;
  appConcurrency: number;
}

export interface AppProtocolSaveRequest {
  requestMethod?: AppRecord['requestMethod'];
  invokeUrl?: string;
  headerTemplate?: string;
  bodyTemplate?: string;
  answerPath?: string;
  successExpression?: string;
  streamEnabled?: boolean;
  appConcurrency?: number;
}

export interface AppEvaluationConfigRecord {
  appCode: string;
  configured: boolean;
  modelId: string;
  promptOverrideEnabled: boolean;
  systemPrompt: string;
  customPrompt: string;
  effectivePrompt: string;
  evaluationConcurrency: number;
}

export interface AppEvaluationConfigSaveRequest {
  modelId: string;
  promptOverrideEnabled?: boolean;
  customPrompt?: string;
  evaluationConcurrency?: number;
}

export interface AppProtocolTestResult {
  success: boolean;
  appCode: string;
  requestMethod: AppRecord['requestMethod'];
  invokeUrl: string;
  sampleInput: Record<string, unknown>;
  resolvedHeaders: string;
  resolvedBody: string;
  rawResponse: Record<string, unknown>;
  rawResponseText: string;
  parsedAnswer: unknown;
  assertion: string;
  message: string;
  elapsedMs: number;
}

type AppPrismaClient = {
  aiApp: {
    findMany(input?: { orderBy?: object }): Promise<unknown[]>;
    findUnique(input: { where: { appCode: string } }): Promise<unknown | null>;
    create(input: { data: object }): Promise<unknown>;
    update(input: { where: { appCode: string }; data: object }): Promise<unknown>;
    delete(input: { where: { appCode: string } }): Promise<unknown>;
  };
  appEvaluationConfig: {
    findUnique(input: { where: { appCode: string } }): Promise<unknown | null>;
    upsert(input: { where: { appCode: string }; create: object; update: object }): Promise<unknown>;
  };
  evalCase: {
    count(input?: { where?: object }): Promise<number>;
  };
  evalPlan: {
    count(input?: { where?: object }): Promise<number>;
  };
  evalRun: {
    findMany(input?: { where?: object; orderBy?: object; take?: number }): Promise<unknown[]>;
  };
  appPresetCategory: {
    findMany(input?: { where?: object; orderBy?: object }): Promise<unknown[]>;
  };
};

export type StoredAppEvaluationConfig = Omit<AppEvaluationConfigRecord, 'configured' | 'systemPrompt' | 'effectivePrompt'>;

export interface AppDataStore {
  list(): Promise<AppRecord[]>;
  statsByAppCode(appCodes: string[]): Promise<Map<string, AppStats>>;
  find(appCode: string): Promise<AppRecord | null>;
  create(record: AppRecord): Promise<AppRecord>;
  update(record: AppRecord): Promise<AppRecord>;
  delete(appCode: string): Promise<AppRecord>;
  findEvaluationConfig(appCode: string): Promise<StoredAppEvaluationConfig | null>;
  saveEvaluationConfig(record: StoredAppEvaluationConfig): Promise<StoredAppEvaluationConfig>;
}

const DEFAULT_HEADER_TEMPLATE = '{\n  "Content-Type": "application/json"\n}';
const DEFAULT_BODY_TEMPLATE = '{\n  "query": "{{case.input.query}}"\n}';
const DEFAULT_ANSWER_PATH = '$.content';
const DEFAULT_SUCCESS_EXPRESSION = '$.code == 0';
const DEFAULT_EXECUTION_CONCURRENCY = 3;
const MIN_EXECUTION_CONCURRENCY = 1;
const MAX_EXECUTION_CONCURRENCY = 10;
const DEFAULT_EVALUATION_PROMPT = [
  '你是 AI 应用质量评估裁判。',
  '请根据测试用例的问题内容、期望回答和被测应用实际回答，判断实际回答是否满足期望。',
  '只返回 JSON，不要输出 Markdown。格式：{"passStatus":"PASS|FAIL|REVIEW","score":0-100,"reason":"评分理由","problemType":"问题类型"}。',
  '当实际回答明确满足期望时给 PASS；明显不满足时给 FAIL；证据不足或需要人工判断时给 REVIEW。',
].join('\n');

function normalizeAppType(value: unknown): AppType {
  if (value === undefined || value === null || value === '') return 'CHAT';
  if (value === 'CHAT') return 'CHAT';
  throw new BadRequestException('当前仅支持 CHAT 类型应用');
}

function normalizeRequestMethod(value: unknown): AppRecord['requestMethod'] {
  if (value === 'GET' || value === 'POST') return value;
  throw new BadRequestException('当前仅支持 GET/POST 请求方法');
}

function readRequiredProtocolString(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(message);
  return value;
}

function readProtocolString(value: unknown, message: string): string {
  if (typeof value !== 'string') throw new Error(message);
  return value;
}

function readRequiredProtocolBoolean(value: unknown, message: string): boolean {
  if (typeof value !== 'boolean') throw new Error(message);
  return value;
}

class AppDatabase implements AppDataStore {
  private readonly prismaPromise: Promise<AppPrismaClient>;

  constructor() {
    this.prismaPromise = this.createClient();
  }

  private normalizeConcurrency(value: unknown) {
    const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
    if (!Number.isFinite(numberValue)) return DEFAULT_EXECUTION_CONCURRENCY;
    return Math.max(MIN_EXECUTION_CONCURRENCY, Math.min(MAX_EXECUTION_CONCURRENCY, Math.round(numberValue)));
  }

  /**
   * @author codex
   * Reads AI applications from MySQL; tests use explicit injected stores.
   */
  async list(): Promise<AppRecord[]> {
    const prisma = await this.prismaPromise;
    const rows = await prisma.aiApp.findMany({ orderBy: { id: 'asc' } });
    return rows.map((row) => this.toRecord(row));
  }

  async statsByAppCode(appCodes: string[]): Promise<Map<string, AppStats>> {
    const prisma = await this.prismaPromise;
    const pairs = await Promise.all(appCodes.map(async (appCode) => [appCode, await this.buildStats(prisma, appCode)] as const));
    return new Map(pairs);
  }

  async find(appCode: string): Promise<AppRecord | null> {
    const prisma = await this.prismaPromise;
    const row = await prisma.aiApp.findUnique({ where: { appCode } });
    return row ? this.toRecord(row) : null;
  }

  async create(record: AppRecord): Promise<AppRecord> {
    const prisma = await this.prismaPromise;
    const saved = await prisma.aiApp.create({ data: this.toPayload(record) });
    return this.toRecord(saved);
  }

  async update(record: AppRecord): Promise<AppRecord> {
    const prisma = await this.prismaPromise;
    const saved = await prisma.aiApp.update({
      where: { appCode: record.appCode },
      data: this.toPayload(record),
    });
    return this.toRecord(saved);
  }

  async delete(appCode: string): Promise<AppRecord> {
    const prisma = await this.prismaPromise;
    const deleted = await prisma.aiApp.delete({ where: { appCode } });
    return this.toRecord(deleted);
  }

  async findEvaluationConfig(appCode: string): Promise<StoredAppEvaluationConfig | null> {
    const prisma = await this.prismaPromise;
    const row = await prisma.appEvaluationConfig.findUnique({ where: { appCode } });
    return row ? this.toEvaluationConfig(row) : null;
  }

  async saveEvaluationConfig(
    record: StoredAppEvaluationConfig,
  ): Promise<StoredAppEvaluationConfig> {
    const prisma = await this.prismaPromise;
    const payload = {
      appCode: record.appCode,
      modelId: BigInt(record.modelId),
      promptOverrideEnabled: record.promptOverrideEnabled,
      customPrompt: record.customPrompt || null,
      evaluationConcurrency: record.evaluationConcurrency,
    };
    const saved = await prisma.appEvaluationConfig.upsert({
      where: { appCode: record.appCode },
      create: payload,
      update: payload,
    });
    return this.toEvaluationConfig(saved);
  }

  private async createClient() {
    return createRuntimePrismaClient<AppPrismaClient>();
  }

  private toPayload(record: AppRecord) {
    return {
      appCode: record.appCode,
      appName: record.appName,
      appType: record.appType,
      invokeUrl: record.invokeUrl,
      requestMethod: record.requestMethod,
      owner: record.owner ?? null,
      status: record.status,
      adapterConfig: {
        ui: {
          icon: this.readRequiredAppIconConfig(record.icon, '应用记录缺少图标配置'),
          description: record.description ?? '',
        },
        response: record.adapterConfig.response,
        execution: {
          appConcurrency: this.normalizeConcurrency(record.adapterConfig.execution?.appConcurrency),
        },
        templates: {
          headerTemplate: record.headerTemplate,
          bodyTemplate: record.bodyTemplate,
          streamEnabled: record.streamEnabled,
        },
      },
    };
  }

  /**
   * @author codex
   * @author Antigravity/Claude-Sonnet-4.6
   * 将数据库行映射为 AppRecord。
   * 核心标识字段（appCode/appName/status 等）严格校验；
   * 协议字段容忍缺失并回退到默认值，避免旧格式记录导致整个列表加载失败。
   */
  private toRecord(row: unknown): AppRecord {
    const data = this.readRecord(row, '应用记录格式不正确');
    // 核心标识：严格校验
    const appCode = this.readRequiredString(data.appCode, '应用记录缺少应用编码');
    const appName = this.readRequiredString(data.appName, '应用记录缺少应用名称');

    // 协议配置：容忍缺失，整块 adapterConfig 可以为空对象
    const adapterConfig = this.readOptionalRecord(data.adapterConfig, '应用协议配置格式不正确');
    const response = this.readOptionalRecord(adapterConfig.response, '应用协议响应配置格式不正确');
    const execution = this.readOptionalRecord(adapterConfig.execution, '应用协议执行配置格式不正确');
    const templates = this.readOptionalRecord(adapterConfig.templates, '应用协议模板配置格式不正确');
    const ui = this.readOptionalRecord(adapterConfig.ui, '应用 UI 配置格式不正确');

    // 图标：严格校验（图标是列表展示的核心视觉元素）
    const icon = this.readRequiredAppIconConfig(ui.icon, '应用记录缺少图标配置');

    return {
      appCode,
      appName,
      appType: this.readPersistedAppType(data.appType),
      description: this.readOptionalString(ui.description, '应用描述不是字符串'),
      invokeUrl: this.readString(data.invokeUrl, '应用记录缺少调用地址'),
      owner: this.readOptionalString(data.owner, '应用负责人不是字符串'),
      status: this.readAppStatus(data.status),
      requestMethod: this.readRequestMethod(data.requestMethod),
      // 协议模板缺失时回退到默认值，后续进入详情页配置
      headerTemplate: typeof templates.headerTemplate === 'string' ? templates.headerTemplate : DEFAULT_HEADER_TEMPLATE,
      bodyTemplate: typeof templates.bodyTemplate === 'string' ? templates.bodyTemplate : DEFAULT_BODY_TEMPLATE,
      streamEnabled: typeof templates.streamEnabled === 'boolean' ? templates.streamEnabled : false,
      adapterConfig: {
        response: {
          answerPath: typeof response.answerPath === 'string' ? response.answerPath : DEFAULT_ANSWER_PATH,
          successExpression: typeof response.successExpression === 'string' ? response.successExpression : DEFAULT_SUCCESS_EXPRESSION,
        },
        execution: {
          appConcurrency: this.normalizeConcurrency(execution.appConcurrency),
        },
      },
      icon,
    };
  }

  private toEvaluationConfig(row: unknown): StoredAppEvaluationConfig {
    const data = this.readRecord(row, '评估配置记录格式不正确');
    return {
      appCode: this.readRequiredString(data.appCode, '评估配置记录缺少应用编码'),
      modelId: this.readRequiredBigIntId(data.modelId, '评估配置记录缺少模型 ID'),
      promptOverrideEnabled: this.readBoolean(data.promptOverrideEnabled, '评估配置记录缺少提示词覆盖开关'),
      customPrompt: this.readOptionalString(data.customPrompt, '评估配置自定义提示词不是字符串') ?? '',
      evaluationConcurrency: this.readConcurrency(data.evaluationConcurrency, '评估配置记录缺少评估并发数'),
    };
  }

  private async buildStats(prisma: AppPrismaClient, appCode: string): Promise<AppStats> {
    const subscriptions = await prisma.appPresetCategory.findMany({ where: { appCode }, orderBy: { id: 'asc' } }) as Array<{ categoryId: unknown }>;
    const subscribedCategoryIds = subscriptions.map((subscription) => this.readRequiredBigInt(subscription.categoryId, '预置分类订阅缺少分类 ID'));
    const caseCount = await prisma.evalCase.count({
      where: {
        enabled: true,
        OR: [
          { appCode, caseScope: 'APP' },
          ...(subscribedCategoryIds.length > 0 ? [{ caseScope: 'SYSTEM_PRESET', categoryId: { in: subscribedCategoryIds } }] : []),
        ],
      },
    });
    const planCount = await prisma.evalPlan.count({ where: { appCode } });
    const latestRuns = await prisma.evalRun.findMany({ where: { appCode }, orderBy: { startedAt: 'desc' }, take: 1 });
    if (latestRuns.length === 0) {
      return {
        caseCount,
        planCount,
      };
    }

    const latestRun = this.readRecord(latestRuns[0], '最近执行记录格式不正确');
    const totalCount = this.readNonNegativeInteger(latestRun.totalCount, '最近执行记录缺少总数');
    const passCount = this.readNonNegativeInteger(latestRun.passCount, '最近执行记录缺少通过数');
    if (passCount > totalCount) throw new Error('最近执行记录通过数超过总数');
    const lastRunAt = this.readRequiredIsoString(latestRun.startedAt, '最近执行记录缺少开始时间');
    return {
      caseCount,
      planCount,
      lastRunAt,
      ...(totalCount > 0 ? { lastPassRate: Math.round((passCount / totalCount) * 100) } : {}),
    };
  }

  private readRequiredBigInt(value: unknown, message: string): bigint {
    if (typeof value === 'bigint' && value > 0n) return value;
    throw new Error(message);
  }

  private readRequiredIsoString(value: unknown, message: string): string {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    throw new Error(message);
  }

  private readRecord(value: unknown, message: string): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    throw new Error(message);
  }

  private readRequiredRecord(value: unknown, message: string): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    throw new Error(message);
  }

  private readOptionalRecord(value: unknown, message: string): Record<string, unknown> {
    if (value === null || value === undefined) return {};
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    throw new Error(message);
  }

  private readRequiredAppIconConfig(value: unknown, message: string): AppIconConfig {
    const icon = normalizeAppIconConfig(value);
    if (icon) return icon;
    throw new Error(message);
  }

  private readRequiredString(value: unknown, message: string): string {
    if (typeof value === 'string' && value.trim()) return value;
    throw new Error(message);
  }

  private readString(value: unknown, message: string): string {
    if (typeof value === 'string') return value;
    throw new Error(message);
  }

  private readOptionalString(value: unknown, message: string): string | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string') return value;
    throw new Error(message);
  }

  private readRequiredBigIntId(value: unknown, message: string): string {
    if (typeof value === 'bigint' && value > 0n) return String(value);
    throw new Error(message);
  }

  private readBoolean(value: unknown, message: string): boolean {
    if (typeof value === 'boolean') return value;
    throw new Error(message);
  }

  private readNonNegativeInteger(value: unknown, message: string): number {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
    throw new Error(message);
  }

  private readConcurrency(value: unknown, message: string): number {
    if (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= MIN_EXECUTION_CONCURRENCY &&
      value <= MAX_EXECUTION_CONCURRENCY
    ) return value;
    throw new Error(message);
  }

  private readPersistedAppType(value: unknown): AppType {
    if (value === 'CHAT') return value;
    throw new Error('应用记录类型非法');
  }

  private readAppStatus(value: unknown): AppRecord['status'] {
    if (value === 'ENABLED' || value === 'DISABLED') return value;
    throw new Error('应用记录状态非法');
  }

  private readRequestMethod(value: unknown): AppRecord['requestMethod'] {
    if (value === 'GET' || value === 'POST') return value;
    throw new Error('应用协议请求方法非法');
  }

}

export class AppService {
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly database: AppDataStore = new AppDatabase(),
  ) { }

  /**
   * @author codex
   * Lists AI apps from MySQL with platform pagination.
   */
  async list(query: AppQuery, page: PageQuery): Promise<PageResult<AppRecord>> {
    const keyword = query.keyword?.trim();
    const all = (await this.getAppSource()).filter((app) => {
      if (!keyword) return true;
      return app.appName.includes(keyword) || app.appCode.includes(keyword);
    });
    const statsByAppCode = await this.database.statsByAppCode(all.map((app) => app.appCode));
    const enriched = all.map((app) => ({
      ...app,
      stats: statsByAppCode.get(app.appCode) ?? app.stats,
    }));
    const start = (page.currentPage - 1) * page.linesPerPage;

    return pageResult(enriched.slice(start, start + page.linesPerPage), page.currentPage, page.linesPerPage, enriched.length);
  }

  async create(request: CreateAppRequest): Promise<AppRecord> {
    const appName = request.appName?.trim();
    if (!appName) throw new BadRequestException('请填写应用名称');

    const appCode = await this.resolveCreateAppCode(request.appCode, appName);
    const existing = await this.findApp(appCode);
    if (existing) {
      throw new BadRequestException('应用编码已存在');
    }
    const record: AppRecord = {
      appCode,
      appName,
      appType: normalizeAppType(request.appType?.trim()),
      description: request.description?.trim() ?? '',
      invokeUrl: request.invokeUrl?.trim() ?? '',
      owner: this.normalizeOwner(request.owner),
      requestMethod: request.requestMethod === undefined ? 'POST' : normalizeRequestMethod(request.requestMethod),
      headerTemplate: request.headerTemplate ?? DEFAULT_HEADER_TEMPLATE,
      bodyTemplate: request.bodyTemplate ?? DEFAULT_BODY_TEMPLATE,
      streamEnabled: request.streamEnabled ?? false,
      status: 'ENABLED',
      adapterConfig: {
        response: {
          answerPath: request.answerPath ?? DEFAULT_ANSWER_PATH,
          successExpression: request.successExpression ?? DEFAULT_SUCCESS_EXPRESSION,
        },
        execution: {
          appConcurrency: this.normalizeConcurrency(request.appConcurrency),
        },
      },
      icon: request.icon === undefined ? createRandomAppIconConfig() : this.readRequestAppIconConfig(request.icon),
    };
    this.assertOptionalInvokeUrlAllowed(record.invokeUrl);
    return this.database.create(record);
  }

  async changeStatus(appCode: string, status: AppRecord['status']): Promise<AppRecord> {
    const app = await this.getApp(appCode);
    return this.database.update({ ...app, status });
  }

  /**
   * @author codex
   * Returns the canonical application record used by frontend workspace pages.
   */
  async detail(appCode: string): Promise<AppRecord> {
    return this.enrichAppStats(await this.getApp(appCode));
  }

  async update(appCode: string, request: UpdateAppRequest): Promise<AppRecord> {
    const app = await this.getApp(appCode);
    const protocolRequest = request as AppProtocolSaveRequest;
    const updated: AppRecord = {
      appCode,
      appName: request.appName ?? app.appName,
      appType: request.appType === undefined ? app.appType : normalizeAppType(request.appType?.trim()),
      description: request.description ?? app.description,
      invokeUrl: request.invokeUrl ?? app.invokeUrl,
      owner: request.owner === undefined ? app.owner : this.normalizeOwner(request.owner),
      status: request.status ?? app.status,
      requestMethod: request.requestMethod === undefined ? app.requestMethod : normalizeRequestMethod(request.requestMethod),
      headerTemplate: request.headerTemplate ?? app.headerTemplate,
      bodyTemplate: request.bodyTemplate ?? app.bodyTemplate,
      streamEnabled: request.streamEnabled ?? app.streamEnabled,
      icon: request.icon === undefined ? app.icon : this.readRequestAppIconConfig(request.icon),
      adapterConfig: {
        ...app.adapterConfig,
        response: {
          answerPath: protocolRequest.answerPath ?? app.adapterConfig.response.answerPath,
          successExpression: protocolRequest.successExpression ?? app.adapterConfig.response.successExpression,
        },
      },
    };
    this.assertOptionalInvokeUrlAllowed(updated.invokeUrl);
    return this.database.update(updated);
  }

  async delete(appCode: string): Promise<AppRecord> {
    await this.getApp(appCode);
    return this.database.delete(appCode);
  }

  /**
   * @author codex
   * Returns only the protocol fields needed by the app integration workbench.
   */
  async protocolDetail(appCode: string): Promise<AppProtocolDetail> {
    const app = await this.getApp(appCode);
    return this.toProtocolDetail(app);
  }

  async evaluationConfigDetail(appCode: string): Promise<AppEvaluationConfigRecord> {
    await this.getApp(appCode);
    const config = await this.findEvaluationConfig(appCode);
    return this.toEvaluationConfigDetail(appCode, config);
  }

  async saveEvaluationConfig(appCode: string, request: AppEvaluationConfigSaveRequest): Promise<AppEvaluationConfigRecord> {
    await this.getApp(appCode);
    const modelId = request.modelId.trim();
    const promptOverrideEnabled = request.promptOverrideEnabled === true;
    const customPrompt = request.customPrompt?.trim() ?? '';
    if (!modelId) throw new Error('请选择评估模型');
    if (promptOverrideEnabled && !customPrompt) throw new Error('请填写覆盖提示词');
    const record = {
      appCode,
      modelId,
      promptOverrideEnabled,
      customPrompt,
      evaluationConcurrency: this.normalizeConcurrency(request.evaluationConcurrency),
    };
    return this.toEvaluationConfigDetail(appCode, await this.database.saveEvaluationConfig(record));
  }

  async saveProtocol(appCode: string, request: AppProtocolSaveRequest): Promise<AppProtocolDetail> {
    const app = await this.getApp(appCode);
    const updated: AppRecord = {
      ...app,
      invokeUrl: request.invokeUrl ?? app.invokeUrl,
      requestMethod: request.requestMethod === undefined ? app.requestMethod : normalizeRequestMethod(request.requestMethod),
      headerTemplate: request.headerTemplate ?? app.headerTemplate,
      bodyTemplate: request.bodyTemplate ?? app.bodyTemplate,
      streamEnabled: request.streamEnabled ?? app.streamEnabled,
      adapterConfig: {
        ...app.adapterConfig,
        response: {
          answerPath: request.answerPath ?? app.adapterConfig.response.answerPath,
          successExpression: request.successExpression ?? app.adapterConfig.response.successExpression,
        },
        execution: {
          appConcurrency: this.normalizeConcurrency(request.appConcurrency ?? app.adapterConfig.execution?.appConcurrency),
        },
      },
    };
    this.assertOptionalInvokeUrlAllowed(updated.invokeUrl);
    return this.toProtocolDetail(await this.database.update(updated));
  }

  async testProtocol(appCode: string, sampleInput: Record<string, unknown>, override: AppProtocolSaveRequest = {}): Promise<AppProtocolTestResult> {
    const app = this.mergeProtocolOverride(await this.getApp(appCode), override);
    this.assertInvokeUrlAllowed(app.invokeUrl);
    const startedAt = Date.now();
    const resolvedHeaders = this.renderTemplate(app.headerTemplate, sampleInput);
    const resolvedBody = this.renderTemplate(app.bodyTemplate, sampleInput);
    const requestHeaders = normalizeApplicationRequestHeaders(
      this.parseRequestJsonObject(resolvedHeaders, '请求头模板'),
      '请求头模板',
    );
    if (app.requestMethod !== 'GET') {
      this.parseRequestJsonObject(resolvedBody, '请求体模板');
    }

    const upstream = await this.fetchImpl(app.invokeUrl, {
      method: app.requestMethod,
      headers: requestHeaders,
      body: app.requestMethod === 'GET' ? undefined : resolvedBody,
    });
    const rawResponseText = await upstream.text();
    const parsedResponse = this.parseProtocolResponse(rawResponseText, upstream.headers?.get('content-type') ?? '', app.adapterConfig.response.answerPath);
    const assertionPassed = app.streamEnabled
      ? upstream.ok
      : this.evaluateSuccessExpression(parsedResponse.rawResponse, app.adapterConfig.response.successExpression);

    return {
      success: upstream.ok && assertionPassed,
      appCode,
      requestMethod: app.requestMethod,
      invokeUrl: app.invokeUrl,
      sampleInput,
      resolvedHeaders,
      resolvedBody,
      rawResponse: parsedResponse.rawResponse,
      rawResponseText,
      parsedAnswer: parsedResponse.parsedAnswer,
      assertion: app.adapterConfig.response.successExpression,
      message: upstream.ok && assertionPassed ? '协议真实调用通过' : '协议真实调用未通过',
      elapsedMs: Date.now() - startedAt,
    };
  }

  private assertOptionalInvokeUrlAllowed(rawUrl: string) {
    if (!rawUrl.trim()) return;
    this.assertInvokeUrlAllowed(rawUrl);
  }

  private assertInvokeUrlAllowed(rawUrl: string) {
    try {
      assertAllowedApplicationInvokeUrl(rawUrl);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : '被测应用调用地址不允许访问');
    }
  }

  private async getAppSource() {
    return (await this.database.list()).map((app) => this.requireAppRecordIcon(app));
  }

  private async findApp(appCode: string): Promise<AppRecord | null> {
    const app = await this.database.find(appCode);
    return app ? this.requireAppRecordIcon(app) : null;
  }

  private async findEvaluationConfig(appCode: string) {
    return this.database.findEvaluationConfig(appCode);
  }

  private async getApp(appCode: string): Promise<AppRecord> {
    const app = await this.findApp(appCode);
    if (!app) throw new Error('应用不存在');
    return app;
  }

  private requireAppRecordIcon(app: AppRecord): AppRecord {
    return {
      ...app,
      icon: this.readRequiredAppIconConfig(app.icon, '应用记录缺少图标配置'),
    };
  }

  /**
   * @author codex
   * Aligns detail pages with list-card aggregate statistics.
   */
  private async enrichAppStats(app: AppRecord): Promise<AppRecord> {
    const statsByAppCode = await this.database.statsByAppCode([app.appCode]);
    return {
      ...app,
      stats: statsByAppCode?.get(app.appCode) ?? app.stats,
    };
  }

  private async resolveCreateAppCode(rawCode: string | undefined, appName: string) {
    const explicitCode = rawCode?.trim();
    if (explicitCode) {
      if (!/^[a-zA-Z0-9_-]+$/u.test(explicitCode)) {
        throw new BadRequestException('应用编码只能包含字母、数字、下划线和中划线');
      }
      return explicitCode;
    }

    const base = this.toAppCodeBase(appName);
    const suffix = randomBytes(4).toString('hex');
    let candidate = `${base}-${suffix}`;
    let index = 1;
    while (await this.findApp(candidate)) {
      candidate = `${base}-${suffix}-${index}`;
      index += 1;
    }
    return candidate;
  }

  private toAppCodeBase(appName: string) {
    const normalized = appName
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[\u0300-\u036f]/gu, '')
      .replace(/[^a-z0-9_-]+/gu, '-')
      .replace(/^-+|-+$/gu, '')
      .replace(/-{2,}/gu, '-');
    return normalized.length > 1 ? normalized : 'app';
  }

  private normalizeOwner(owner: unknown): string | undefined {
    return typeof owner === 'string' && owner.trim() ? owner.trim() : undefined;
  }

  private toProtocolDetail(app: AppRecord): AppProtocolDetail {
    return {
      appCode: app.appCode,
      appName: app.appName,
      requestMethod: app.requestMethod,
      invokeUrl: app.invokeUrl,
      headerTemplate: app.headerTemplate,
      bodyTemplate: app.bodyTemplate,
      answerPath: app.adapterConfig.response.answerPath,
      successExpression: app.adapterConfig.response.successExpression,
      streamEnabled: app.streamEnabled,
      appConcurrency: this.normalizeConcurrency(app.adapterConfig.execution?.appConcurrency),
    };
  }

  private toEvaluationConfigDetail(
    appCode: string,
    config: Omit<AppEvaluationConfigRecord, 'configured' | 'systemPrompt' | 'effectivePrompt'> | null,
  ): AppEvaluationConfigRecord {
    const customPrompt = config?.customPrompt ?? '';
    const promptOverrideEnabled = config?.promptOverrideEnabled === true;
    const effectivePrompt = promptOverrideEnabled && customPrompt ? customPrompt : DEFAULT_EVALUATION_PROMPT;
    return {
      appCode,
      configured: !!config?.modelId,
      modelId: config?.modelId ?? '',
      promptOverrideEnabled,
      systemPrompt: DEFAULT_EVALUATION_PROMPT,
      customPrompt,
      effectivePrompt,
      evaluationConcurrency: this.normalizeConcurrency(config?.evaluationConcurrency),
    };
  }

  private normalizeConcurrency(value: unknown) {
    const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
    if (!Number.isFinite(numberValue)) return DEFAULT_EXECUTION_CONCURRENCY;
    return Math.max(MIN_EXECUTION_CONCURRENCY, Math.min(MAX_EXECUTION_CONCURRENCY, Math.round(numberValue)));
  }

  private readRequestAppIconConfig(value: unknown): AppIconConfig {
    const icon = normalizeAppIconConfig(value);
    if (icon) return icon;
    throw new BadRequestException('应用图标配置不正确');
  }

  private readRequiredAppIconConfig(value: unknown, message: string): AppIconConfig {
    const icon = normalizeAppIconConfig(value);
    if (icon) return icon;
    throw new Error(message);
  }

  private mergeProtocolOverride(app: AppRecord, override: AppProtocolSaveRequest): AppRecord {
    return {
      ...app,
      invokeUrl: override.invokeUrl ?? app.invokeUrl,
      requestMethod: override.requestMethod === undefined ? app.requestMethod : normalizeRequestMethod(override.requestMethod),
      headerTemplate: override.headerTemplate ?? app.headerTemplate,
      bodyTemplate: override.bodyTemplate ?? app.bodyTemplate,
      streamEnabled: override.streamEnabled ?? app.streamEnabled,
      adapterConfig: {
        ...app.adapterConfig,
        response: {
          answerPath: override.answerPath ?? app.adapterConfig.response.answerPath,
          successExpression: override.successExpression ?? app.adapterConfig.response.successExpression,
        },
        execution: {
          appConcurrency: this.normalizeConcurrency(override.appConcurrency ?? app.adapterConfig.execution?.appConcurrency),
        },
      },
    };
  }

  private renderTemplate(template: string, data: Record<string, unknown>) {
    return template.replace(/\{\{([^}]+)}}/g, (_, rawPath: string) => {
      const path = rawPath.trim().replace(/^case\.input\./, '');
      return String(this.readObjectPath(data, path) ?? '');
    });
  }

  private readObjectPath(data: Record<string, unknown>, path: string) {
    return path.split('.').reduce<unknown>((current, key) => {
      if (!current || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[key];
    }, data);
  }

  private parseJsonObject(text: string, label = '应用响应'): Record<string, unknown> {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new BadRequestException(`${label}不是合法 JSON 对象`);
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`${label}不是合法 JSON 对象`);
    }
  }

  private parseRequestJsonObject(text: string, label: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new BadRequestException(`${label}不是合法 JSON 对象`);
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`${label}不是合法 JSON 对象`);
    }
  }

  private parseProtocolResponse(rawText: string, contentType: string, answerPath: string) {
    if (contentType.includes('text/event-stream') || rawText.split('\n').some((line) => line.startsWith('data:'))) {
      return this.parseEventStreamResponse(rawText, answerPath);
    }
    const rawResponse = this.parseJsonObject(rawText, '应用响应');
    return {
      rawResponse,
      parsedAnswer: this.readJsonPath(rawResponse, answerPath),
    };
  }

  private parseEventStreamResponse(rawText: string, answerPath: string) {
    const events: Record<string, unknown>[] = [];
    let answer = '';
    for (const line of rawText.split(/\r?\n/u)) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      const event = this.parseJsonObject(data, '流式响应事件');
      events.push(event);
      const piece = this.readJsonPath(event, answerPath);
      if (piece !== undefined && piece !== null) {
        answer += typeof piece === 'string' ? piece : JSON.stringify(piece);
      }
    }
    return {
      rawResponse: { events },
      parsedAnswer: answer || undefined,
    };
  }

  private readJsonPath(data: Record<string, unknown>, path: string) {
    const normalizedPath = path.replace(/^\$\./, '');
    return this.readObjectPath(data, normalizedPath);
  }

  private evaluateSuccessExpression(data: Record<string, unknown>, expression: string) {
    const normalized = expression.trim();
    if (!normalized) return true;
    const [path, expectedRaw] = normalized.split('==').map((item) => item.trim());
    if (!path || expectedRaw === undefined) return false;
    const expected = expectedRaw.replace(/^['"]|['"]$/g, '');
    const actual = this.readJsonPath(data, path);
    if (actual === undefined || actual === null) return false;
    return String(actual) === expected;
  }
}
