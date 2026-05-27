export const CONTEXT_PATH = 'ai-quality-platform';

export type ServiceKey =
  | 'web'
  | 'gateway'
  | 'platform'
  | 'execution';

export type DeployableServiceKey = ServiceKey;

export type PublicApiSegment =
  | 'business'
  | 'case'
  | 'plan'
  | 'execution'
  | 'ai'
  | 'review'
  | 'statistics'
  | 'system';

export type BackendServiceKey = PublicApiSegment;

export const GATEWAY_PORT = 8080;

const SERVICE_PORTS: Record<ServiceKey, number> = {
  web: 3000,
  gateway: 8080,
  platform: 3101,
  execution: 3104,
};

const SERVICE_HOST_ENV: Partial<Record<DeployableServiceKey, string>> = {
  gateway: 'GATEWAY_SERVICE_HOST',
  platform: 'PLATFORM_SERVICE_HOST',
  execution: 'EXECUTION_SERVICE_HOST',
};

const PUBLIC_SERVICE_SEGMENTS: Record<PublicApiSegment, string> = {
  business: 'business',
  case: 'case',
  plan: 'plan',
  execution: 'execution',
  ai: 'ai',
  review: 'review',
  statistics: 'statistics',
  system: 'system',
};

const PUBLIC_API_SEGMENTS = [
  'business',
  'case',
  'plan',
  'execution',
  'ai',
  'review',
  'statistics',
  'system',
] as const satisfies ReadonlyArray<PublicApiSegment>;

const API_SEGMENT_TO_DEPLOYABLE_SERVICE: Record<PublicApiSegment, DeployableServiceKey> = {
  business: 'platform',
  case: 'platform',
  plan: 'platform',
  execution: 'execution',
  ai: 'platform',
  review: 'platform',
  statistics: 'platform',
  system: 'platform',
};

type BrowserLocationLike = {
  host?: string;
  hostname?: string;
  port?: string;
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
export function getLocalServiceUrl(service: DeployableServiceKey): string {
  return `http://${getLocalServiceHost(service)}:${getServicePort(service)}`;
}

/**
 * @author codex
 * Resolves a public API segment to the runtime service that currently owns it.
 */
export function getDeployableServiceForApiSegment(segment: PublicApiSegment): DeployableServiceKey {
  return API_SEGMENT_TO_DEPLOYABLE_SERVICE[segment];
}

/**
 * @author codex
 * Exposes the public API routing table for diagnostics and health pages.
 */
export function getPublicApiRouteMappings(): Array<{ segment: PublicApiSegment; targetService: DeployableServiceKey }> {
  return PUBLIC_API_SEGMENTS.map((segment) => ({
    segment,
    targetService: getDeployableServiceForApiSegment(segment),
  }));
}

/**
 * @author codex
 * Uses the browser page host for public gateway calls so LAN access does not call the visitor's own localhost.
 */
function readPublicGatewayOriginOverride(): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const value = env?.NEXT_PUBLIC_GATEWAY_ORIGIN?.trim();
  return value || undefined;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

/**
 * @author codex
 * Node development uses the standalone gateway port; production behind nginx uses same-origin paths.
 */
function getPublicGatewayOrigin(): string {
  const override = readPublicGatewayOriginOverride();
  if (override === 'same-origin') return '';
  if (override) return trimTrailingSlash(override);

  const location = (globalThis as { location?: BrowserLocationLike }).location;
  const hostname = location?.hostname || '127.0.0.1';
  const protocol = location?.protocol === 'https:' ? 'https:' : 'http:';
  if (location?.port && location.port !== String(SERVICE_PORTS.web)) return '';
  return `${protocol}//${hostname}:${GATEWAY_PORT}`;
}

function getLocalServiceHost(service: DeployableServiceKey): string {
  const envName = SERVICE_HOST_ENV[service];
  if (!envName) return '127.0.0.1';
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.[envName] || '127.0.0.1';
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
export function getGatewayApiUrl(service: PublicApiSegment, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return getGatewayPublicUrl(`/${CONTEXT_PATH}/api/${PUBLIC_SERVICE_SEGMENTS[service]}${normalizedPath}`);
}
