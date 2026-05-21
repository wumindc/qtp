import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller';

describe('quality-review-service health', () => {
  it('returns the platform health envelope', () => {
    const response = new HealthController().health();

    expect(response.data.service).toBe('quality-review-service');
    expect(response.data.status).toBe('UP');
    expect(response.data.database).toBe('UP');
    expect(response.data.redis).toBe('UP');
    expect(response.success).toBe(true);
  });
});
