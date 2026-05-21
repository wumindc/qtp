import { getGatewayApiUrl, type BackendServiceKey } from '@ai-quality-platform/shared-config';

interface GatewayEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T & { message?: string };
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
  const response = await fetch(getGatewayApiUrl(service, path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    body: JSON.stringify(body),
    ...init,
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
  const record = payload as { list?: TItem[]; data?: { list?: TItem[] } };
  if (Array.isArray(record.list)) return record.list;
  if (Array.isArray(record.data?.list)) return record.data.list;
  return [];
}
