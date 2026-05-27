import { afterEach, describe, expect, it } from 'vitest';
import { CONTEXT_PATH, getGatewayApiUrl, getServicePort } from './index';

describe('shared config', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'location');
  });

  it('uses the ai-quality-platform context path', () => {
    expect(CONTEXT_PATH).toBe('ai-quality-platform');
  });

  it('returns planned local service ports', () => {
    expect(getServicePort('web')).toBe(3000);
    expect(getServicePort('gateway')).toBe(8080);
    expect(getServicePort('business')).toBe(3101);
    expect(getServicePort('system')).toBe(3108);
  });

  it('builds public API URLs through the unified gateway port', () => {
    expect(getGatewayApiUrl('business', '/app/list.do')).toBe(
      'http://127.0.0.1:8080/ai-quality-platform/api/business/app/list.do',
    );
    expect(getGatewayApiUrl('system', '/health.do')).toBe(
      'http://127.0.0.1:8080/ai-quality-platform/api/system/health.do',
    );
  });

  it('uses the current browser hostname for public gateway URLs', () => {
    Object.defineProperty(globalThis, 'location', {
      value: { hostname: '192.168.11.107', protocol: 'http:' },
      configurable: true,
    });

    expect(getGatewayApiUrl('ai', '/provider/list.do')).toBe(
      'http://192.168.11.107:8080/ai-quality-platform/api/ai/provider/list.do',
    );
  });
});
