export const CONTEXT_PATH = 'ai-quality-platform';

export type ServiceKey =
  | 'web'
  | 'gateway'
  | 'business'
  | 'case'
  | 'plan'
  | 'execution'
  | 'ai'
  | 'review'
  | 'statistics'
  | 'system';

export type BackendServiceKey = Exclude<ServiceKey, 'web' | 'gateway'>;

export const GATEWAY_PORT = 8080;

const SERVICE_PORTS: Record<ServiceKey, number> = {
  web: 3000,
  gateway: 8080,
  business: 3101,
  case: 3102,
  plan: 3103,
  execution: 3104,
  ai: 3105,
  review: 3106,
  statistics: 3107,
  system: 3108,
};

const PUBLIC_SERVICE_SEGMENTS: Record<BackendServiceKey, string> = {
  business: 'business',
  case: 'case',
  plan: 'plan',
  execution: 'execution',
  ai: 'ai',
  review: 'review',
  statistics: 'statistics',
  system: 'system',
};

type BrowserLocationLike = {
  hostname?: string;
  protocol?: string;
};

/**
 * @author codex
 * Centralizes planned local ports so frontend and services do not drift.
 */
export function getServicePort(service: ServiceKey): number {
  return SERVICE_PORTS[service];
}

/**
 * @author codex
 * Builds the internal service base URL used by local service processes.
 */
export function getLocalServiceUrl(service: BackendServiceKey): string {
  return `http://127.0.0.1:${getServicePort(service)}`;
}

/**
 * @author codex
 * Uses the browser page host for public gateway calls so LAN access does not call the visitor's own localhost.
 */
function getPublicGatewayOrigin(): string {
  const location = (globalThis as { location?: BrowserLocationLike }).location;
  const hostname = location?.hostname || '127.0.0.1';
  const protocol = location?.protocol === 'https:' ? 'https:' : 'http:';
  return `${protocol}//${hostname}:${GATEWAY_PORT}`;
}

/**
 * @author codex
 * Builds public gateway URLs that should follow the current browser host.
 */
export function getGatewayPublicUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getPublicGatewayOrigin()}${normalizedPath}`;
}

/**
 * @author codex
 * Builds the public URL that frontend code should call through the gateway.
 */
export function getGatewayApiUrl(service: BackendServiceKey, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return getGatewayPublicUrl(`/${CONTEXT_PATH}/api/${PUBLIC_SERVICE_SEGMENTS[service]}${normalizedPath}`);
}
