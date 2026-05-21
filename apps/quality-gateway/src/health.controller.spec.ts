import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller';

describe('quality-gateway health', () => {
  it('returns the platform health envelope', () => {
    const response = new HealthController().health();

    expect(response.data.service).toBe('quality-gateway');
    expect(response.data.status).toBe('UP');
    expect(response.data.port).toBe(8080);
    expect(response.success).toBe(true);
  });
});
