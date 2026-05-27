import { describe, expect, it } from 'vitest';
import { buildGatewayTargetUrl } from './gateway-router';

describe('gateway router', () => {
  it('maps public business API paths to the platform service', () => {
    expect(buildGatewayTargetUrl('business', '/app/list.do')).toBe(
      'http://127.0.0.1:3101/ai-quality-platform/app/list.do',
    );
  });

  it('maps public system API paths to the platform service', () => {
    expect(buildGatewayTargetUrl('system', '/health.do')).toBe(
      'http://127.0.0.1:3101/ai-quality-platform/health.do',
    );
  });

  it('maps public case and ai API paths to the platform service', () => {
    expect(buildGatewayTargetUrl('case', '/case/list.do')).toBe(
      'http://127.0.0.1:3101/ai-quality-platform/case/list.do',
    );
    expect(buildGatewayTargetUrl('ai', '/provider/list.do')).toBe(
      'http://127.0.0.1:3101/ai-quality-platform/provider/list.do',
    );
  });

  it('keeps execution API paths on the execution service', () => {
    expect(buildGatewayTargetUrl('execution', '/execution/start.do')).toBe(
      'http://127.0.0.1:3104/ai-quality-platform/execution/start.do',
    );
  });
});
