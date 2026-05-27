import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller';

describe('quality-execution-service health', () => {
  it('returns the execution service health envelope', async () => {
    const response = await new HealthController().health();

    expect(response.data.service).toBe('quality-execution-service');
    expect(response.data.status).toBe('UP');
    expect(response.success).toBe(true);
  });

  it('returns worker recovery and activity diagnostics', async () => {
    const response = await new HealthController({
      getWorkerHealth: async () => ({
        enabled: true,
        activeRunCount: 2,
        runningRunCount: 3,
        lastHeartbeatAt: '2026-05-27T01:00:00.000Z',
        lastRecoveryAt: '2026-05-27T00:59:00.000Z',
        lastRecoveryStatus: 'SUCCEEDED',
        recoveredRunCount: 1,
      }),
    } as never).health();

    expect(response.data.worker).toEqual({
      enabled: true,
      activeRunCount: 2,
      runningRunCount: 3,
      lastHeartbeatAt: '2026-05-27T01:00:00.000Z',
      lastRecoveryAt: '2026-05-27T00:59:00.000Z',
      lastRecoveryStatus: 'SUCCEEDED',
      recoveredRunCount: 1,
    });
  });
});
