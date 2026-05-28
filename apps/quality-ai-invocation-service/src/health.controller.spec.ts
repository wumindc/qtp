import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller';

describe('quality-ai-invocation-service health', () => {
  it('returns the internal AI invocation service health envelope', async () => {
    const response = await new HealthController().health();

    expect(response.data).toMatchObject({
      service: 'quality-ai-invocation-service',
      status: 'UP',
      port: 3105,
    });
  });
});
