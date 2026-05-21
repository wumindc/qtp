import { getGatewayApiUrl, type BackendServiceKey } from '@ai-quality-platform/shared-config';

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

/**
 * @author codex
 * Sends typed JSON requests to backend gateway .do endpoints.
 */
export async function postGateway<TResponse = unknown>(
  service: BackendServiceKey,
  path: string,
  body: Record<string, unknown>,
  init?: RequestInit,
): Promise<TResponse> {
  const { headers, ...restInit } = init ?? {};
  const response = await fetch(getGatewayApiUrl(service, path), {
    ...restInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...normalizeHeaders(headers) },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as GatewayEnvelope<TResponse> & TResponse;

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message ?? payload.data?.message ?? '请求失败');
  }

  return (payload.data ?? payload) as TResponse;
}

/**
 * @author codex
 * Reads common list shapes returned by gateway list endpoints.
 */
export function readGatewayList<TItem>(payload: unknown): TItem[] {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as { list?: TItem[]; data?: { list?: TItem[] } };
  if (Array.isArray(record.list)) return record.list;
  if (Array.isArray(record.data?.list)) return record.data.list;
  return [];
}
