import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONTEXT_PATH,
  getDeployableServiceForApiSegment,
  getGatewayApiUrl,
  getLocalServiceUrl,
  getPublicApiRouteMappings,
  getServicePort,
} from './index';

describe('shared config', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'location');
    vi.unstubAllEnvs();
  });

  it('uses the ai-quality-platform context path', () => {
    expect(CONTEXT_PATH).toBe('ai-quality-platform');
  });

  it('returns planned local service ports', () => {
    expect(getServicePort('web')).toBe(3000);
    expect(getServicePort('gateway')).toBe(8080);
    expect(getServicePort('platform')).toBe(3101);
    expect(getServicePort('execution')).toBe(3104);
  });

  it('maps public API segments to their deployable runtime services', () => {
    for (const segment of ['business', 'case', 'plan', 'ai', 'review', 'statistics', 'system'] as const) {
      expect(getDeployableServiceForApiSegment(segment)).toBe('platform');
    }
    expect(getDeployableServiceForApiSegment('execution')).toBe('execution');
  });

  it('exposes public API route mappings for health diagnostics', () => {
    expect(getPublicApiRouteMappings()).toEqual([
      { segment: 'business', targetService: 'platform' },
      { segment: 'case', targetService: 'platform' },
      { segment: 'plan', targetService: 'platform' },
      { segment: 'execution', targetService: 'execution' },
      { segment: 'ai', targetService: 'platform' },
      { segment: 'review', targetService: 'platform' },
      { segment: 'statistics', targetService: 'platform' },
      { segment: 'system', targetService: 'platform' },
    ]);
  });

  it('builds public API URLs through the unified gateway port for node development', () => {
    Object.defineProperty(globalThis, 'location', {
      value: { hostname: '127.0.0.1', port: '3000', protocol: 'http:' },
      configurable: true,
    });

    expect(getGatewayApiUrl('business', '/app/list.do')).toBe(
      'http://127.0.0.1:8080/ai-quality-platform/api/business/app/list.do',
    );
    expect(getGatewayApiUrl('system', '/health.do')).toBe(
      'http://127.0.0.1:8080/ai-quality-platform/api/system/health.do',
    );
  });

  it('uses the current browser hostname for node development gateway URLs', () => {
    Object.defineProperty(globalThis, 'location', {
      value: { hostname: '192.168.11.107', port: '3000', protocol: 'http:' },
      configurable: true,
    });

    expect(getGatewayApiUrl('ai', '/provider/list.do')).toBe(
      'http://192.168.11.107:8080/ai-quality-platform/api/ai/provider/list.do',
    );
  });

  it('uses same-origin public API URLs behind the production nginx entry', () => {
    Object.defineProperty(globalThis, 'location', {
      value: { hostname: 'qtp.example.com', port: '5670', protocol: 'http:' },
      configurable: true,
    });

    expect(getGatewayApiUrl('system', '/health.do')).toBe('/ai-quality-platform/api/system/health.do');
  });

  it('allows production builds to force same-origin gateway URLs', () => {
    vi.stubEnv('NEXT_PUBLIC_GATEWAY_ORIGIN', 'same-origin');

    expect(getGatewayApiUrl('execution', '/execution/run-list.do')).toBe(
      '/ai-quality-platform/api/execution/execution/run-list.do',
    );
  });

  it('allows deployable service hosts to be overridden for container networking', () => {
    vi.stubEnv('PLATFORM_SERVICE_HOST', 'quality-platform-service');
    vi.stubEnv('EXECUTION_SERVICE_HOST', 'quality-execution-service');

    expect(getLocalServiceUrl('platform')).toBe('http://quality-platform-service:3101');
    expect(getLocalServiceUrl('execution')).toBe('http://quality-execution-service:3104');
  });
});
