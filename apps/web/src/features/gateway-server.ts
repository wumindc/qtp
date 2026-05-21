import { getGatewayApiUrl, type BackendServiceKey } from '@ai-quality-platform/shared-config';

type GatewayRow = Record<string, unknown>;

interface LoadGatewayListOptions {
  service: BackendServiceKey;
  path: string;
  mapRow: (item: GatewayRow) => string[];
  data?: Record<string, unknown>;
}

/**
 * @author codex
 * Loads list data on the server through the public gateway without local fallback records.
 */
export async function loadGatewayList({ service, path, mapRow, data = {} }: LoadGatewayListOptions) {
  const url = getGatewayApiUrl(service, path);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: { currentPage: 1, linesPerPage: 20 },
        data,
      }),
      cache: 'no-store',
    });
    const payload = await response.json();
    const list = Array.isArray(payload.list) ? payload.list : Array.isArray(payload.data?.list) ? payload.data.list : [];

    return {
      url,
      rows: list.map((item: GatewayRow) => mapRow(item)),
      status: 'ready' as const,
      live: true,
    };
  } catch {
    return { url, rows: [] as string[][], status: 'error' as const, live: false };
  }
}

/**
 * @author codex
 * Loads raw gateway records so route pages can map them into interactive console rows.
 */
export async function loadGatewayRecords(service: BackendServiceKey, path: string, data: Record<string, unknown> = {}) {
  const url = getGatewayApiUrl(service, path);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: { currentPage: 1, linesPerPage: 50 },
        data,
      }),
      cache: 'no-store',
    });
    const payload = await response.json();
    const list = Array.isArray(payload.list) ? payload.list : Array.isArray(payload.data?.list) ? payload.data.list : [];
    return { url, records: list as GatewayRow[], status: 'ready' as const, live: true };
  } catch {
    return { url, records: [] as GatewayRow[], status: 'error' as const, live: false };
  }
}
