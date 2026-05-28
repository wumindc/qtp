export const CONTEXT_PATH = 'ai-quality-platform';

export type ServiceKey =
  | 'web'
  | 'gateway'
  | 'platform'
  | 'execution'
  | 'aiInvocation';

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
  aiInvocation: 3105,
};

const SERVICE_HOST_ENV: Partial<Record<DeployableServiceKey, string>> = {
  gateway: 'GATEWAY_SERVICE_HOST',
  platform: 'PLATFORM_SERVICE_HOST',
  execution: 'EXECUTION_SERVICE_HOST',
  aiInvocation: 'AI_INVOCATION_SERVICE_HOST',
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

export interface ApplicationInvokeUrlValidationOptions {
  env?: Record<string, string | undefined>;
}

export interface ApplicationInvokeUrlValidationResult {
  allowed: boolean;
  reason?: string;
}

export interface ApplicationRequestHeaderValidationResult {
  allowed: boolean;
  headers?: Record<string, string>;
  reason?: string;
}

const REQUEST_HEADER_NAME_RE = /^[!#$%&'*+\-.^_`|~0-9a-zA-Z]+$/u;

const FORBIDDEN_REQUEST_HEADERS = new Set([
  'connection',
  'content-length',
  'content-encoding',
  'transfer-encoding',
  'upgrade',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'keep-alive',
  'host',
]);

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

/**
 * @author codex
 * Prevents production app execution from turning stored invoke URLs into internal network probes.
 */
export function validateApplicationInvokeUrl(
  rawUrl: string,
  options: ApplicationInvokeUrlValidationOptions = {},
): ApplicationInvokeUrlValidationResult {
  const value = rawUrl.trim();
  if (!value) return { allowed: false, reason: '被测应用调用地址不能为空' };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { allowed: false, reason: '被测应用调用地址不是合法 URL' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { allowed: false, reason: '被测应用调用地址只允许 http 或 https 协议' };
  }

  const env = options.env ?? readProcessEnv();
  const allowedOrigins = readAllowedApplicationInvokeOrigins(env);
  if (allowedOrigins.error) {
    return { allowed: false, reason: allowedOrigins.error };
  }
  if (allowedOrigins.origins.has(url.origin)) {
    return { allowed: true };
  }
  if (!isProductionRuntime(env)) {
    return { allowed: true };
  }

  const hostname = normalizeHostname(url.hostname);
  if (isLoopbackHost(hostname)) {
    return { allowed: false, reason: '生产环境不允许访问 localhost 或回环地址' };
  }
  if (isPrivateNetworkHost(hostname)) {
    return { allowed: false, reason: '生产环境不允许访问内网地址，确需访问请配置 QTP_ALLOWED_APP_INVOKE_ORIGINS' };
  }
  if (isInternalServiceHostname(hostname)) {
    return { allowed: false, reason: '生产环境不允许访问 Docker 内部服务名，确需访问请配置 QTP_ALLOWED_APP_INVOKE_ORIGINS' };
  }

  return { allowed: true };
}

/**
 * @author codex
 * Throws a stable product-facing error when an application invoke URL is outside the runtime policy.
 */
export function assertAllowedApplicationInvokeUrl(
  rawUrl: string,
  options: ApplicationInvokeUrlValidationOptions = {},
): void {
  const result = validateApplicationInvokeUrl(rawUrl, options);
  if (!result.allowed) {
    throw new Error(`被测应用调用地址不允许访问：${result.reason ?? '不符合当前运行环境策略'}`);
  }
}

/**
 * @author codex
 * Filters request headers to prevent hop-by-hop/proxy/control header injection.
 */
export function validateApplicationRequestHeaders(
  rawHeaders: Record<string, unknown>,
  label = '请求头模板',
): ApplicationRequestHeaderValidationResult {
  const headers: Record<string, string> = {};

  for (const [name, value] of Object.entries(rawHeaders)) {
    const trimmedName = String(name).trim();
    if (!trimmedName) {
      return {
        allowed: false,
        reason: `${label}包含空请求头名`,
      };
    }

    if (!REQUEST_HEADER_NAME_RE.test(trimmedName)) {
      return {
        allowed: false,
        reason: `${label}包含非法请求头名：${trimmedName}`,
      };
    }

    const normalizedName = trimmedName.toLowerCase();
    if (FORBIDDEN_REQUEST_HEADERS.has(normalizedName)) {
      return {
        allowed: false,
        reason: `${label}包含禁用请求头：${trimmedName}`,
      };
    }

    headers[trimmedName] = String(value);
  }

  return {
    allowed: true,
    headers,
  };
}

/**
 * @author codex
 * Normalizes raw JSON headers into a safe string-map, reusing validation result.
 */
export function normalizeApplicationRequestHeaders(
  rawHeaders: Record<string, unknown>,
  label = '请求头模板',
): Record<string, string> {
  const result = validateApplicationRequestHeaders(rawHeaders, label);
  if (!result.allowed || !result.headers) {
    throw new Error(result.reason ?? `${label}包含不合法请求头`);
  }
  return result.headers;
}

function readProcessEnv(): Record<string, string | undefined> {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
}

function isProductionRuntime(env: Record<string, string | undefined>) {
  return env.NODE_ENV === 'production' || env.QTP_RUNTIME_ENV === 'production';
}

function readAllowedApplicationInvokeOrigins(env: Record<string, string | undefined>) {
  const origins = new Set<string>();
  for (const rawOrigin of (env.QTP_ALLOWED_APP_INVOKE_ORIGINS ?? '').split(',')) {
    const value = rawOrigin.trim();
    if (!value) continue;
    try {
      origins.add(new URL(value).origin);
    } catch {
      return {
        origins,
        error: `QTP_ALLOWED_APP_INVOKE_ORIGINS 包含非法 URL：${value}`,
      };
    }
  }
  return { origins };
}

function normalizeHostname(hostname: string) {
  return hostname.trim().toLowerCase().replace(/^\[/u, '').replace(/\]$/u, '').replace(/\.$/u, '');
}

function isLoopbackHost(hostname: string): boolean {
  const mappedIpv4 = parseIpv4MappedIpv6(hostname);
  return hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname === '::1'
    || hostname.startsWith('127.')
    || Boolean(mappedIpv4 && isLoopbackHost(mappedIpv4));
}

function isPrivateNetworkHost(hostname: string): boolean {
  const mappedIpv4 = parseIpv4MappedIpv6(hostname);
  const ipv4Parts = parseIpv4(mappedIpv4 ?? hostname);
  if (ipv4Parts) {
    const [first, second] = ipv4Parts;
    return first === 0
      || first === 10
      || first === 100 && second >= 64 && second <= 127
      || first === 169 && second === 254
      || first === 172 && second >= 16 && second <= 31
      || first === 192 && second === 168
      || first === 198 && (second === 18 || second === 19)
      || first >= 224;
  }
  return hostname === '::'
    || hostname.startsWith('fe80:')
    || hostname.startsWith('fc')
    || hostname.startsWith('fd');
}

function isInternalServiceHostname(hostname: string): boolean {
  if (parseIpv4(hostname) || hostname.includes(':')) return false;
  if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.docker')) return true;
  return !hostname.includes('.');
}

function parseIpv4MappedIpv6(hostname: string): string | null {
  if (!hostname.startsWith('::ffff:')) return null;
  const value = hostname.slice('::ffff:'.length);
  if (parseIpv4(value)) return value;
  const groups = value.split(':');
  if (groups.length !== 2) return null;
  const high = Number.parseInt(groups[0], 16);
  const low = Number.parseInt(groups[1], 16);
  if (!Number.isInteger(high) || !Number.isInteger(low) || high < 0 || high > 0xffff || low < 0 || low > 0xffff) {
    return null;
  }
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

function parseIpv4(hostname: string): [number, number, number, number] | null {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;
  const numbers = parts.map((part) => Number(part));
  if (numbers.some((part, index) => !Number.isInteger(part) || part < 0 || part > 255 || String(part) !== parts[index])) {
    return null;
  }
  return numbers as [number, number, number, number];
}
