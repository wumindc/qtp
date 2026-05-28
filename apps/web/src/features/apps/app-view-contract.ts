/**
 * AI 应用展示契约校验
 * @author codex
 */

import type { App, AppProtocol } from './types';

export type AppWithViewData = App & {
  protocol: AppProtocol;
  stats: NonNullable<App['stats']>;
};

function isRecord(value: unknown) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readNumber(value: unknown, message: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(message);
  }
  return value;
}

function readOptionalNumber(value: unknown, message: string) {
  if (value === undefined || value === null) return undefined;
  return readNumber(value, message);
}

function readString(value: unknown, message: string) {
  if (typeof value !== 'string') {
    throw new Error(message);
  }
  return value;
}

function readBoolean(value: unknown, message: string) {
  if (typeof value !== 'boolean') {
    throw new Error(message);
  }
  return value;
}

function readProtocol(value: unknown, source: string): AppProtocol {
  if (!isRecord(value)) {
    throw new Error(`${source}缺少应用协议配置`);
  }
  const protocol = value as Record<string, unknown>;
  const method = protocol.method;
  if (method !== 'GET' && method !== 'POST') {
    throw new Error(`${source}包含不支持的请求方法`);
  }
  return {
    method,
    url: readString(protocol.url, `${source}缺少调用地址`),
    headers: readString(protocol.headers, `${source}缺少请求头模板`),
    body: readString(protocol.body, `${source}缺少请求体模板`),
    answerPath: readString(protocol.answerPath, `${source}缺少答案提取路径`),
    successExpr: readString(protocol.successExpr, `${source}缺少成功条件`),
    streamEnabled: readBoolean(protocol.streamEnabled, `${source}缺少流式配置`),
    appConcurrency: readNumber(protocol.appConcurrency, `${source}缺少执行并发`),
  };
}

function readStats(value: unknown, source: string): AppWithViewData['stats'] {
  if (!isRecord(value)) {
    throw new Error(`${source}缺少应用统计信息`);
  }
  const stats = value as Record<string, unknown>;
  const lastRunAt = stats.lastRunAt;
  if (lastRunAt !== undefined && lastRunAt !== null && typeof lastRunAt !== 'string') {
    throw new Error(`${source}最近执行时间必须是字符串`);
  }
  return {
    caseCount: readNumber(stats.caseCount, `${source}缺少用例统计`),
    planCount: readNumber(stats.planCount, `${source}缺少计划统计`),
    lastRunAt: lastRunAt ?? undefined,
    lastPassRate: readOptionalNumber(stats.lastPassRate, `${source}包含非法通过率`),
  };
}

export function assertAppViewData(app: App, source: string): AppWithViewData {
  return {
    ...app,
    protocol: readProtocol(app.protocol, source),
    stats: readStats(app.stats, source),
  };
}
