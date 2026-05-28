import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HealthController } from './health.controller';

describe('quality-platform-service health', () => {
  it('does not keep a test-environment database probe bypass in production code', () => {
    const source = readFileSync(join(process.cwd(), 'src/health.controller.ts'), 'utf8');

    expect(source).not.toContain('process.env.VITEST');
    expect(source).not.toContain('vitest skips runtime database probe');
  });

  it('returns the platform service health envelope', async () => {
    const response = await new HealthController({
      database: async () => ({ status: 'UP', message: 'SELECT 1 ok' }),
      modelProviders: async () => ({ status: 'DIAGNOSTIC_ONLY', message: 'check from model center' }),
    }).health();

    expect(response.data.service).toBe('quality-platform-service');
    expect(response.data.status).toBe('UP');
    expect(response.data.port).toBe(3101);
    expect(response.success).toBe(true);
  });

  it('returns dependency diagnostics for current runtime dependencies only', async () => {
    const response = await new HealthController({
      database: async () => ({ status: 'UP', message: 'SELECT 1 ok' }),
      modelProviders: async () => ({ status: 'DIAGNOSTIC_ONLY', message: 'check from model center' }),
    }).health();

    expect(response.data.dependencies).toEqual({
      database: { status: 'UP', message: 'SELECT 1 ok' },
      modelProviders: { status: 'DIAGNOSTIC_ONLY', message: 'check from model center' },
    });
    expect(response.data.dependencies).not.toHaveProperty('redis');
  });
});
