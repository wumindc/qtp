import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller';

describe('quality-platform-service health', () => {
  it('returns the platform service health envelope', async () => {
    const response = await new HealthController().health();

    expect(response.data.service).toBe('quality-platform-service');
    expect(response.data.status).toBe('UP');
    expect(response.data.port).toBe(3101);
    expect(response.success).toBe(true);
  });

  it('returns dependency diagnostics for database, redis and model providers', async () => {
    const response = await new HealthController({
      database: async () => ({ status: 'UP', message: 'SELECT 1 ok' }),
      redis: async () => ({ status: 'DISABLED', message: 'not required for platform boot' }),
      modelProviders: async () => ({ status: 'DIAGNOSTIC_ONLY', message: 'check from model center' }),
    }).health();

    expect(response.data.dependencies).toEqual({
      database: { status: 'UP', message: 'SELECT 1 ok' },
      redis: { status: 'DISABLED', message: 'not required for platform boot' },
      modelProviders: { status: 'DIAGNOSTIC_ONLY', message: 'check from model center' },
    });
  });
});
