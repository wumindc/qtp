/**
 * AI application API client.
 * @author codex
 */
import { postGateway, readGatewayList } from '@/lib/api/gateway-client';
import type { App, AppProtocol, AppStatus, AppType } from '../types';
import { normalizeAppIconConfig } from '../app-icon-config';

type GatewayRow = Record<string, unknown>;
const APP_TYPES: AppType[] = ['CHAT'];
const APP_STATUSES: AppStatus[] = ['ENABLED', 'DISABLED'];
const REQUEST_METHODS: AppProtocol['method'][] = ['GET', 'POST'];

function asRecord(value: unknown, message: string): GatewayRow {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as GatewayRow;
  throw new Error(message);
}

function readStringField(value: unknown, message: string) {
  if (typeof value === 'string') return value;
  throw new Error(message);
}

function readOptionalStringField(value: unknown, message: string) {
  if (value === undefined || value === null) return undefined;
  return readStringField(value, message);
}

function readRequiredStringField(value: unknown, message: string) {
  const text = readStringField(value, message);
  if (!text.trim()) throw new Error(message);
  return text;
}

function readEnum<TValue extends string>(value: unknown, allowed: readonly TValue[], message: string): TValue {
  if (allowed.includes(value as TValue)) return value as TValue;
  throw new Error(`${message}：${String(value)}`);
}

function readRequestMethod(value: unknown, source: string): AppProtocol['method'] {
  return readEnum(value, REQUEST_METHODS, `${source}包含不支持的请求方法`);
}

function readBooleanField(value: unknown, message: string) {
  if (typeof value !== 'boolean') throw new Error(message);
  return value;
}

function readNumberField(value: unknown, message: string) {
  if (value === undefined || value === null || value === '') throw new Error(message);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(message);
  return parsed;
}

function readOptionalNumberField(value: unknown, message: string) {
  if (value === undefined || value === null || value === '') return undefined;
  return readNumberField(value, message);
}

function readAppStats(value: unknown) {
  const statsRaw = asRecord(value, '应用列表响应缺少统计信息');
  return {
    caseCount: readNumberField(statsRaw.caseCount, '应用列表响应缺少用例统计'),
    planCount: readNumberField(statsRaw.planCount, '应用列表响应缺少计划统计'),
    lastRunAt: readOptionalStringField(statsRaw.lastRunAt, '应用列表响应最近执行时间必须是字符串'),
    lastPassRate: readOptionalNumberField(statsRaw.lastPassRate, '应用列表响应包含非法通过率'),
  };
}

function readAppIcon(value: unknown) {
  const icon = normalizeAppIconConfig(value);
  if (!icon) throw new Error('应用列表响应缺少图标配置');
  return icon;
}

function mapApp(item: GatewayRow): App {
  const adapterConfig = asRecord(item.adapterConfig, '应用列表响应缺少协议配置');
  const responseConfig = asRecord(adapterConfig.response, '应用列表响应缺少响应解析配置');
  const executionConfig = asRecord(adapterConfig.execution, '应用列表响应缺少执行配置');

  return {
    appCode: readRequiredStringField(item.appCode, '应用列表响应缺少应用编码'),
    appName: readRequiredStringField(item.appName, '应用列表响应缺少应用名称'),
    appType: readEnum(item.appType, APP_TYPES, '应用列表响应包含不支持的应用类型'),
    description: readOptionalStringField(item.description, '应用列表响应描述必须是字符串') ?? '',
    owner: readOptionalStringField(item.owner, '应用列表响应负责人必须是字符串') ?? '',
    status: readEnum(item.status, APP_STATUSES, '应用列表响应包含不支持的应用状态'),
    protocol: {
      method: readRequestMethod(item.requestMethod, '应用列表响应'),
      url: readStringField(item.invokeUrl, '应用列表响应缺少调用地址'),
      headers: readStringField(item.headerTemplate, '应用列表响应缺少请求头模板'),
      body: readStringField(item.bodyTemplate, '应用列表响应缺少请求体模板'),
      answerPath: readStringField(responseConfig.answerPath, '应用列表响应缺少答案提取路径'),
      successExpr: readStringField(responseConfig.successExpression, '应用列表响应缺少成功条件'),
      streamEnabled: readBooleanField(item.streamEnabled, '应用列表响应缺少流式配置'),
      appConcurrency: readNumberField(executionConfig.appConcurrency, '应用列表响应缺少执行并发'),
    },
    stats: readAppStats(item.stats),
    icon: readAppIcon(item.icon),
    createdAt: readOptionalStringField(item.createdAt, '应用列表响应创建时间必须是字符串'),
    updatedAt: readOptionalStringField(item.updatedAt, '应用列表响应更新时间必须是字符串'),
  };
}

export async function loadApps(): Promise<App[]> {
  const result = await postGateway<unknown>(
    'business',
    '/app/list.do',
    { page: { currentPage: 1, linesPerPage: 100 }, data: {} },
    { cache: 'no-store' }
  );
  return readGatewayList<GatewayRow>(result).map(mapApp);
}

export async function loadApp(appCode: string): Promise<App | null> {
  const result = await postGateway<GatewayRow>('business', '/app/detail.do', { appCode }, { cache: 'no-store' });
  if (!result) return null;
  return mapApp(result);
}

export async function saveApp(app: Partial<App>, editingCode?: string) {
  const payload = {
    appName: app.appName?.trim(),
    appType: app.appType,
    description: app.description?.trim(),
    owner: app.owner?.trim() ?? '',
    status: app.status,
  };
  if (editingCode) {
    return postGateway<GatewayRow>('business', '/app/update.do', { appCode: editingCode, data: payload });
  }
  return postGateway<GatewayRow>('business', '/app/create.do', payload);
}

export async function deleteApp(appCode: string) {
  return postGateway('business', '/app/delete.do', { appCode });
}

export async function changeAppStatus(appCode: string, status: AppStatus) {
  return postGateway('business', '/app/change-status.do', { appCode, status });
}

export async function loadAppProtocol(appCode: string): Promise<AppProtocol> {
  const result = await postGateway<GatewayRow>('business', '/app/protocol/detail.do', { appCode }, { cache: 'no-store' });
  return {
    method: readRequestMethod(result.requestMethod, '应用协议响应'),
    url: readStringField(result.invokeUrl, '应用协议响应缺少调用地址'),
    headers: readStringField(result.headerTemplate, '应用协议响应缺少请求头模板'),
    body: readStringField(result.bodyTemplate, '应用协议响应缺少请求体模板'),
    answerPath: readStringField(result.answerPath, '应用协议响应缺少答案提取路径'),
    successExpr: readStringField(result.successExpression, '应用协议响应缺少成功条件'),
    streamEnabled: readBooleanField(result.streamEnabled, '应用协议响应缺少流式配置'),
    appConcurrency: readNumberField(result.appConcurrency, '应用协议响应缺少执行并发'),
  };
}

export async function saveAppProtocol(appCode: string, protocol: AppProtocol) {
  const data = {
    requestMethod: protocol.method,
    invokeUrl: protocol.url,
    headerTemplate: protocol.headers,
    bodyTemplate: protocol.body,
    answerPath: protocol.answerPath,
    successExpression: protocol.successExpr,
    streamEnabled: protocol.streamEnabled,
    appConcurrency: protocol.appConcurrency,
  };
  return postGateway('business', '/app/protocol/save.do', { appCode, data });
}

export interface AppProtocolTestResult {
  success: boolean;
  appCode: string;
  requestMethod: AppProtocol['method'];
  invokeUrl: string;
  sampleInput: Record<string, unknown>;
  resolvedHeaders: string;
  resolvedBody: string;
  rawResponse: Record<string, unknown>;
  rawResponseText: string;
  parsedAnswer?: unknown;
  assertion: string;
  message: string;
  elapsedMs: number;
}

export async function testAppProtocol(appCode: string, protocol: AppProtocol, query: string, init?: RequestInit): Promise<AppProtocolTestResult> {
  const data = {
    requestMethod: protocol.method,
    invokeUrl: protocol.url,
    headerTemplate: protocol.headers,
    bodyTemplate: protocol.body,
    answerPath: protocol.answerPath,
    successExpression: protocol.successExpr,
    streamEnabled: protocol.streamEnabled,
    appConcurrency: protocol.appConcurrency,
  };
  return postGateway<AppProtocolTestResult>(
    'business',
    '/app/protocol/test.do',
    { appCode, data, sampleInput: { query } },
    { cache: 'no-store', ...init },
  );
}
