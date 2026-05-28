/**
 * @author codex
 * @author Antigravity/Claude-Sonnet-4.6
 * Gateway HTTP client for backend .do endpoints.
 */
import { getGatewayApiUrl, type BackendServiceKey } from '@ai-quality-platform/shared-config';
import { readAuthToken } from '@/lib/auth-session';

interface GatewayEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T & { message?: string };
}

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return headers as Record<string, string>;
}

export async function postGateway<TResponse = unknown>(
  service: BackendServiceKey,
  path: string,
  body: Record<string, unknown>,
  init?: RequestInit,
): Promise<TResponse> {
  const { headers, ...restInit } = init ?? {};
  const token = readAuthToken();
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(getGatewayApiUrl(service, path), {
    ...restInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders, ...normalizeHeaders(headers) },
    body: JSON.stringify(body),
  });
  let payload: GatewayEnvelope<TResponse> & TResponse;
  try {
    payload = (await response.json()) as GatewayEnvelope<TResponse> & TResponse;
  } catch {
    throw new Error('网关返回非法 JSON');
  }

  if (!response.ok || payload.success === false) {
    const rawMessage = payload.message ?? payload.data?.message;
    // 对通用英文服务器错误做友好提示，附加接口路径作为上下文
    if (!rawMessage || /^internal server error$/i.test(rawMessage.trim())) {
      throw new Error(`服务器内部错误（${path}），请联系管理员或稍后重试`);
    }
    throw new Error(rawMessage);
  }

  return (payload.data ?? payload) as TResponse;
}

/**
 * @author codex
 * Reads common list shapes returned by gateway list endpoints.
 */
export function readGatewayList<TItem>(payload: unknown): TItem[] {
  if (!payload || typeof payload !== 'object') throw new Error('网关列表响应缺少 list 数组');
  const record = payload as { list?: TItem[] };
  if (Array.isArray(record.list)) return record.list;
  throw new Error('网关列表响应缺少 list 数组');
}
