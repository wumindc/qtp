import { describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller';

describe('quality-gateway health', () => {
  it('returns the aggregated platform and execution health envelope', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { status: 'UP', dependencies: { database: { status: 'UP' } } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { status: 'UP', worker: { runningRunCount: 0, activeRunCount: 0 } } }),
      });
    const response = await new HealthController(fetchImpl as unknown as typeof fetch).health();

    expect(response.data.service).toBe('quality-gateway');
    expect(response.data.status).toBe('UP');
    expect(response.data.services.platform).toMatchObject({ dependencies: { database: { status: 'UP' } } });
    expect(response.data.services.execution).toMatchObject({ worker: { runningRunCount: 0 } });
    expect(response.success).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:3101/ai-quality-platform/health.do');
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:3104/ai-quality-platform/health.do');
  });

  it('marks aggregate health down when an internal service is unreachable', async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { status: 'UP' } }),
      });
    const response = await new HealthController(fetchImpl as unknown as typeof fetch).health();

    expect(response.data.status).toBe('DOWN');
    expect(response.data.services.platform.status).toBe('DOWN');
    expect(response.data.services.platform.message).toBe('connect ECONNREFUSED');
  });
});
