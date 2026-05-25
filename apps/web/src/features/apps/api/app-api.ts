import { postGateway, readGatewayList } from '@/lib/api/gateway-client';
import type { App, AppProtocol, AppStatus, AppType } from '../types';

type GatewayRow = Record<string, unknown>;

function toStringField(value: unknown, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function mapApp(item: GatewayRow): App {
  const protocol = (item.protocol ?? {}) as Record<string, unknown>;
  return {
    appCode: toStringField(item.appCode),
    appName: toStringField(item.appName),
    appType: (item.appType as AppType) ?? 'CHAT',
    description: toStringField(item.description),
    owner: toStringField(item.owner, 'system'),
    status: (item.status as AppStatus) ?? 'ENABLED',
    protocol: {
      method: (protocol.method as 'GET' | 'POST') ?? 'POST',
      url: toStringField(protocol.url),
      headers: toStringField(protocol.headers),
      body: toStringField(protocol.body),
      answerPath: toStringField(protocol.answerPath),
      successExpr: toStringField(protocol.successExpr),
      streamEnabled: Boolean(protocol.streamEnabled),
    },
    defaultEvalModelId: toStringField(item.defaultEvalModelId),
    createdAt: toStringField(item.createdAt),
    updatedAt: toStringField(item.updatedAt),
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
    owner: app.owner?.trim() || 'system',
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
  const protocol = result ?? {};
  return {
    method: (protocol.requestMethod as 'GET' | 'POST') ?? 'POST',
    url: toStringField(protocol.invokeUrl),
    headers: toStringField(protocol.headerTemplate, '{\n  "Content-Type": "application/json"\n}'),
    body: toStringField(protocol.bodyTemplate, '{\n  "query": "{{case.query}}"\n}'),
    answerPath: toStringField(protocol.answerPath, '$.data.answer'),
    successExpr: toStringField(protocol.successExpression, '$.code == 0'),
    streamEnabled: Boolean(protocol.streamEnabled),
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
  };
  return postGateway('business', '/app/protocol/save.do', { appCode, data });
}
