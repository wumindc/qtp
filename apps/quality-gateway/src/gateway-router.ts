import {
  CONTEXT_PATH,
  getDeployableServiceForApiSegment,
  getLocalServiceUrl,
  type PublicApiSegment,
} from '@ai-quality-platform/shared-config';

/**
 * @author codex
 * Converts a public gateway segment to the internal service URL.
 */
export function buildGatewayTargetUrl(service: PublicApiSegment, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const deployableService = getDeployableServiceForApiSegment(service);

  return `${getLocalServiceUrl(deployableService)}/${CONTEXT_PATH}${normalizedPath}`;
}
