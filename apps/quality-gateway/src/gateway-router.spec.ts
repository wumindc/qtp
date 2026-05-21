import { describe, expect, it } from 'vitest';
import { buildGatewayTargetUrl } from './gateway-router';

describe('gateway router', () => {
  it('maps public business API paths to the internal business service', () => {
    expect(buildGatewayTargetUrl('business', '/app/list.do')).toBe(
      'http://127.0.0.1:3101/ai-quality-platform/app/list.do',
    );
  });

  it('maps public health paths to the internal system service', () => {
    expect(buildGatewayTargetUrl('system', '/health.do')).toBe(
      'http://127.0.0.1:3108/ai-quality-platform/health.do',
    );
  });
});
