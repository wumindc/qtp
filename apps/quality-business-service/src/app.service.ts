import { createRuntimePrismaClient } from '@ai-quality-platform/shared-database';
import { pageResult, type PageResult } from '@ai-quality-platform/shared-http';

export interface AppRecord {
  appCode: string;
  appName: string;
  appType: string;
  businessDomain: string;
  invokeUrl: string;
  owner?: string;
  status: 'ENABLED' | 'DISABLED';
  requestMethod: 'GET' | 'POST' | 'PUT' | 'PATCH';
  authType: 'NONE' | 'API_KEY' | 'BEARER_TOKEN' | 'BASIC';
  authConfig?: Record<string, unknown>;
  headerTemplate: string;
  bodyTemplate: string;
  requestSchema: string;
  responseSchema: string;
  streamEnabled: boolean;
  adapterConfig: {
    response: {
      answerPath: string;
      successExpression: string;
    };
  };
}

export interface AppQuery {
  keyword?: string;
}

export interface PageQuery {
  currentPage: number;
  linesPerPage: number;
}

export interface CreateAppRequest {
  appCode: string;
  appName: string;
  appType: string;
  businessDomain: string;
  invokeUrl: string;
  owner?: string;
  requestMethod?: AppRecord['requestMethod'];
  authType?: AppRecord['authType'];
  authConfig?: Record<string, unknown>;
  headerTemplate?: string;
  bodyTemplate?: string;
  requestSchema?: string;
  responseSchema?: string;
  answerPath?: string;
  successExpression?: string;
  streamEnabled?: boolean;
}

export type UpdateAppRequest = Partial<Omit<AppRecord, 'appCode'>>;

export interface AppProtocolDetail {
  appCode: string;
  appName: string;
  requestMethod: AppRecord['requestMethod'];
  invokeUrl: string;
  authType: AppRecord['authType'];
  authConfig?: Record<string, unknown>;
  headerTemplate: string;
  bodyTemplate: string;
  requestSchema: string;
  responseSchema: string;
  answerPath: string;
  successExpression: string;
  streamEnabled: boolean;
}

export interface AppProtocolSaveRequest {
  requestMethod?: AppRecord['requestMethod'];
  invokeUrl?: string;
  authType?: AppRecord['authType'];
  authConfig?: Record<string, unknown>;
  headerTemplate?: string;
  bodyTemplate?: string;
  requestSchema?: string;
  responseSchema?: string;
  answerPath?: string;
  successExpression?: string;
  streamEnabled?: boolean;
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
};

const DEFAULT_HEADER_TEMPLATE = '{\n  "Content-Type": "application/json"\n}';
const DEFAULT_BODY_TEMPLATE = '{\n  "query": "{{case.input.query}}"\n}';
const DEFAULT_REQUEST_SCHEMA = '{\n  "query": "string"\n}';
const DEFAULT_RESPONSE_SCHEMA = '{\n  "data": {\n    "content": "string"\n  }\n}';
const DEFAULT_ANSWER_PATH = '$.data.content';
const DEFAULT_SUCCESS_EXPRESSION = '$.code == 0';

class AppDatabase {
  private readonly prismaPromise: Promise<AppPrismaClient | null>;

  constructor() {
    this.prismaPromise = this.createClient();
  }

  /**
   * @author codex
   * Reads AI applications from MySQL; test runs use the in-memory path without seeded records.
   */
  async list(): Promise<AppRecord[] | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const rows = await prisma.aiApp.findMany({ orderBy: { id: 'asc' } });
    return rows.map((row) => this.toRecord(row));
  }

  async find(appCode: string): Promise<AppRecord | null | undefined> {
    const prisma = await this.prismaPromise;
    if (!prisma) return undefined;
    const row = await prisma.aiApp.findUnique({ where: { appCode } });
    return row ? this.toRecord(row) : null;
  }

  async create(record: AppRecord): Promise<AppRecord | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const saved = await prisma.aiApp.create({ data: this.toPayload(record) });
    return this.toRecord(saved);
  }

  async update(record: AppRecord): Promise<AppRecord | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const saved = await prisma.aiApp.update({
      where: { appCode: record.appCode },
      data: this.toPayload(record),
    });
    return this.toRecord(saved);
  }

  async delete(appCode: string): Promise<AppRecord | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const deleted = await prisma.aiApp.delete({ where: { appCode } });
    return this.toRecord(deleted);
  }

  private async createClient() {
    if (process.env.VITEST) return null;
    return createRuntimePrismaClient<AppPrismaClient>();
  }

  private toPayload(record: AppRecord) {
    return {
      appCode: record.appCode,
      appName: record.appName,
      appType: record.appType,
      businessDomain: record.businessDomain,
      invokeUrl: record.invokeUrl,
      requestMethod: record.requestMethod,
      authType: record.authType,
      authConfig: record.authConfig ?? undefined,
      owner: record.owner,
      status: record.status,
      adapterConfig: {
        response: record.adapterConfig.response,
        templates: {
          headerTemplate: record.headerTemplate,
          bodyTemplate: record.bodyTemplate,
          requestSchema: record.requestSchema,
          responseSchema: record.responseSchema,
          streamEnabled: record.streamEnabled,
        },
      },
    };
  }

  private toRecord(row: unknown): AppRecord {
    const data = this.asRecord(row);
    const adapterConfig = this.asRecord(data.adapterConfig);
    const response = this.asRecord(adapterConfig.response);
    const templates = this.asRecord(adapterConfig.templates);

    return {
      appCode: String(data.appCode),
      appName: String(data.appName),
      appType: String(data.appType),
      businessDomain: String(data.businessDomain),
      invokeUrl: String(data.invokeUrl ?? ''),
      owner: typeof data.owner === 'string' ? data.owner : undefined,
      status: data.status === 'DISABLED' ? 'DISABLED' : 'ENABLED',
      requestMethod: this.normalizeMethod(data.requestMethod),
      authType: this.normalizeAuthType(data.authType),
      authConfig: this.asOptionalRecord(data.authConfig),
      headerTemplate: String(templates.headerTemplate ?? DEFAULT_HEADER_TEMPLATE),
      bodyTemplate: String(templates.bodyTemplate ?? DEFAULT_BODY_TEMPLATE),
      requestSchema: String(templates.requestSchema ?? DEFAULT_REQUEST_SCHEMA),
      responseSchema: String(templates.responseSchema ?? DEFAULT_RESPONSE_SCHEMA),
      streamEnabled: templates.streamEnabled === true,
      adapterConfig: {
        response: {
          answerPath: String(response.answerPath ?? DEFAULT_ANSWER_PATH),
          successExpression: String(response.successExpression ?? DEFAULT_SUCCESS_EXPRESSION),
        },
      },
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private asOptionalRecord(value: unknown): Record<string, unknown> | undefined {
    const record = this.asRecord(value);
    return Object.keys(record).length > 0 ? record : undefined;
  }

  private normalizeMethod(value: unknown): AppRecord['requestMethod'] {
    return value === 'GET' || value === 'PUT' || value === 'PATCH' ? value : 'POST';
  }

  private normalizeAuthType(value: unknown): AppRecord['authType'] {
    return value === 'API_KEY' || value === 'BEARER_TOKEN' || value === 'BASIC' ? value : 'NONE';
  }
}

export class AppService {
  private readonly database = new AppDatabase();
  private readonly apps = new Map<string, AppRecord>();

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

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
    const start = (page.currentPage - 1) * page.linesPerPage;

    return pageResult(all.slice(start, start + page.linesPerPage), page.currentPage, page.linesPerPage, all.length);
  }

  async create(request: CreateAppRequest): Promise<AppRecord> {
    const existing = await this.findApp(request.appCode);
    if (existing) {
      throw new Error('应用编码已存在');
    }
    const record: AppRecord = {
      ...request,
      requestMethod: request.requestMethod ?? 'POST',
      authType: request.authType ?? 'NONE',
      headerTemplate: request.headerTemplate ?? DEFAULT_HEADER_TEMPLATE,
      bodyTemplate: request.bodyTemplate ?? DEFAULT_BODY_TEMPLATE,
      requestSchema: request.requestSchema ?? DEFAULT_REQUEST_SCHEMA,
      responseSchema: request.responseSchema ?? DEFAULT_RESPONSE_SCHEMA,
      streamEnabled: request.streamEnabled ?? false,
      status: 'ENABLED',
      adapterConfig: {
        response: {
          answerPath: request.answerPath ?? DEFAULT_ANSWER_PATH,
          successExpression: request.successExpression ?? DEFAULT_SUCCESS_EXPRESSION,
        },
      },
    };
    return this.persist(record);
  }

  async changeStatus(appCode: string, status: AppRecord['status']): Promise<AppRecord> {
    const app = await this.getApp(appCode);
    return this.persist({ ...app, status });
  }

  async update(appCode: string, request: UpdateAppRequest): Promise<AppRecord> {
    const app = await this.getApp(appCode);
    const protocolRequest = request as AppProtocolSaveRequest;
    const updated: AppRecord = {
      ...app,
      ...request,
      appCode,
      adapterConfig: {
        ...app.adapterConfig,
        response: {
          answerPath: protocolRequest.answerPath ?? app.adapterConfig.response.answerPath,
          successExpression: protocolRequest.successExpression ?? app.adapterConfig.response.successExpression,
        },
      },
    };
    return this.persist(updated);
  }

  async delete(appCode: string): Promise<AppRecord> {
    const app = await this.getApp(appCode);
    const deleted = await this.database.delete(appCode);
    this.apps.delete(appCode);
    return deleted ?? app;
  }

  /**
   * @author codex
   * Returns only the protocol fields needed by the app integration workbench.
   */
  async protocolDetail(appCode: string): Promise<AppProtocolDetail> {
    const app = await this.getApp(appCode);
    return this.toProtocolDetail(app);
  }

  async saveProtocol(appCode: string, request: AppProtocolSaveRequest): Promise<AppProtocolDetail> {
    const app = await this.getApp(appCode);
    const updated: AppRecord = {
      ...app,
      invokeUrl: request.invokeUrl ?? app.invokeUrl,
      requestMethod: request.requestMethod ?? app.requestMethod,
      authType: request.authType ?? app.authType,
      authConfig: request.authConfig ?? app.authConfig,
      headerTemplate: request.headerTemplate ?? app.headerTemplate,
      bodyTemplate: request.bodyTemplate ?? app.bodyTemplate,
      requestSchema: request.requestSchema ?? app.requestSchema,
      responseSchema: request.responseSchema ?? app.responseSchema,
      streamEnabled: request.streamEnabled ?? app.streamEnabled,
      adapterConfig: {
        ...app.adapterConfig,
        response: {
          answerPath: request.answerPath ?? app.adapterConfig.response.answerPath,
          successExpression: request.successExpression ?? app.adapterConfig.response.successExpression,
        },
      },
    };
    return this.toProtocolDetail(await this.persist(updated));
  }

  async testProtocol(appCode: string, sampleInput: Record<string, unknown>): Promise<AppProtocolTestResult> {
    const app = await this.getApp(appCode);
    const startedAt = Date.now();
    const resolvedHeaders = this.renderTemplate(app.headerTemplate, sampleInput);
    const resolvedBody = this.renderTemplate(app.bodyTemplate, sampleInput);
    const requestHeaders = Object.entries(this.parseJsonObject(resolvedHeaders)).reduce<Record<string, string>>(
      (headers, [key, value]) => ({ ...headers, [key]: String(value) }),
      {},
    );

    const upstream = await this.fetchImpl(app.invokeUrl, {
      method: app.requestMethod,
      headers: requestHeaders,
      body: app.requestMethod === 'GET' ? undefined : resolvedBody,
    });
    const rawText = await upstream.text();
    const rawResponse = this.parseJsonObject(rawText);
    const parsedAnswer = this.readJsonPath(rawResponse, app.adapterConfig.response.answerPath);
    const assertionPassed = this.evaluateSuccessExpression(rawResponse, app.adapterConfig.response.successExpression);

    return {
      success: upstream.ok && assertionPassed,
      appCode,
      requestMethod: app.requestMethod,
      invokeUrl: app.invokeUrl,
      sampleInput,
      resolvedHeaders,
      resolvedBody,
      rawResponse,
      parsedAnswer,
      assertion: app.adapterConfig.response.successExpression,
      message: upstream.ok && assertionPassed ? '协议真实调用通过' : '协议真实调用未通过',
      elapsedMs: Date.now() - startedAt,
    };
  }

  private async getAppSource() {
    const databaseApps = await this.database.list();
    if (databaseApps) {
      this.apps.clear();
      databaseApps.forEach((app) => this.apps.set(app.appCode, app));
      return databaseApps;
    }
    return Array.from(this.apps.values());
  }

  private async findApp(appCode: string): Promise<AppRecord | null> {
    const databaseApp = await this.database.find(appCode);
    if (databaseApp !== undefined) {
      if (databaseApp) this.apps.set(databaseApp.appCode, databaseApp);
      return databaseApp;
    }
    return this.apps.get(appCode) ?? null;
  }

  private async getApp(appCode: string): Promise<AppRecord> {
    const app = await this.findApp(appCode);
    if (!app) throw new Error('应用不存在');
    return app;
  }

  private async persist(record: AppRecord) {
    const saved = this.apps.has(record.appCode) ? await this.database.update(record) : await this.database.create(record);
    const next = saved ?? record;
    this.apps.set(next.appCode, next);
    return next;
  }

  private toProtocolDetail(app: AppRecord): AppProtocolDetail {
    return {
      appCode: app.appCode,
      appName: app.appName,
      requestMethod: app.requestMethod,
      invokeUrl: app.invokeUrl,
      authType: app.authType,
      authConfig: app.authConfig,
      headerTemplate: app.headerTemplate,
      bodyTemplate: app.bodyTemplate,
      requestSchema: app.requestSchema,
      responseSchema: app.responseSchema,
      answerPath: app.adapterConfig.response.answerPath,
      successExpression: app.adapterConfig.response.successExpression,
      streamEnabled: app.streamEnabled,
    };
  }

  private renderTemplate(template: string, data: Record<string, unknown>) {
    return template.replace(/\{\{([^}]+)}}/g, (_, rawPath: string) => {
      const path = rawPath.trim().replace(/^case\.input\./, '').replace(/^case\./, '');
      return String(this.readObjectPath(data, path) ?? '');
    });
  }

  private readObjectPath(data: Record<string, unknown>, path: string) {
    return path.split('.').reduce<unknown>((current, key) => {
      if (!current || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[key];
    }, data);
  }

  private parseJsonObject(text: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private readJsonPath(data: Record<string, unknown>, path: string) {
    const normalizedPath = path.replace(/^\$\./, '');
    return this.readObjectPath(data, normalizedPath);
  }

  private evaluateSuccessExpression(data: Record<string, unknown>, expression: string) {
    const normalized = expression.trim();
    if (!normalized) return true;
    const [path, expectedRaw] = normalized.split('==').map((item) => item.trim());
    if (!path || expectedRaw === undefined) return true;
    const expected = expectedRaw.replace(/^['"]|['"]$/g, '');
    return String(this.readJsonPath(data, path)) === expected;
  }
}
