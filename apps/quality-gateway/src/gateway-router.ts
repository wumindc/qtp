import {
  type BackendServiceKey,
  CONTEXT_PATH,
  getLocalServiceUrl,
} from '@ai-quality-platform/shared-config';

/**
 * @author codex
 * Converts a public gateway segment to the internal service URL.
 */
export function buildGatewayTargetUrl(service: BackendServiceKey, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${getLocalServiceUrl(service)}/${CONTEXT_PATH}${normalizedPath}`;
}
