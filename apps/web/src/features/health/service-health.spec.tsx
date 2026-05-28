import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HealthPage } from './service-health';

describe('HealthPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists the deployable platform runtime services', async () => {
    render(<HealthPage />);

    expect(await screen.findByText('quality-gateway')).toBeInTheDocument();
    expect(screen.getAllByText('quality-platform-service').length).toBeGreaterThan(0);
    expect(screen.getAllByText('quality-execution-service').length).toBeGreaterThan(0);
    expect(screen.getAllByText('quality-ai-invocation-service').length).toBeGreaterThan(0);
    expect(screen.queryByText('quality-business-service')).not.toBeInTheDocument();
    expect(screen.queryByText('quality-case-service')).not.toBeInTheDocument();
  });

  it('does not display gateway or internal service URLs', async () => {
    render(<HealthPage />);

    expect(await screen.findByText('quality-gateway')).toBeInTheDocument();
    expect(screen.queryByText(/http:\/\//u)).not.toBeInTheDocument();
    expect(
      screen.queryByText('http://127.0.0.1:3101/ai-quality-platform/health.do'),
    ).not.toBeInTheDocument();
  });

  it('shows public API routing relationships for consolidated services', async () => {
    render(<HealthPage />);

    expect(await screen.findByText('公开 API 路由')).toBeInTheDocument();
    expect(screen.getByText('business / case / plan / ai / review / statistics / system')).toBeInTheDocument();
    expect(screen.getAllByText('quality-platform-service').length).toBeGreaterThan(1);
    expect(screen.getAllByText('execution').length).toBeGreaterThan(0);
  });

  it('checks one aggregated gateway health endpoint when the recheck button is clicked', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          status: 'UP',
          services: {
            gateway: { status: 'UP' },
            platform: {
              status: 'UP',
              dependencies: { database: { status: 'UP', message: 'SELECT 1 ok' } },
            },
            execution: {
              status: 'UP',
              worker: { activeRunCount: 1, runningRunCount: 2, lastRecoveryStatus: 'SUCCEEDED' },
            },
            aiInvocation: { status: 'UP' },
          },
        },
      }),
    } as unknown as Response);

    render(<HealthPage />);
    await screen.findByText('quality-gateway');
    fireEvent.click(screen.getByRole('button', { name: '重新检查' }));

    await waitFor(() => expect(screen.getByText(/最近检查：/u)).toBeInTheDocument());
    expect(screen.getAllByText('UP').length).toBeGreaterThanOrEqual(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/ai-quality-platform/health.do'),
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(screen.getAllByText(/数据库：UP/u).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Worker：运行 2，活跃 1/u).length).toBeGreaterThan(0);
  });

  it('marks services down when the aggregated health response is not valid JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    } as unknown as Response);

    render(<HealthPage />);
    await screen.findByText('quality-gateway');
    fireEvent.click(screen.getByRole('button', { name: '重新检查' }));

    await waitFor(() => expect(screen.getByText(/最近检查：/u)).toBeInTheDocument());
    expect(screen.getAllByText('异常').length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText('健康检查返回非法 JSON').length).toBeGreaterThan(0);
  });

  it('does not turn malformed execution worker diagnostics into zero counts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          status: 'UP',
          services: {
            gateway: { status: 'UP' },
            platform: { status: 'UP' },
            execution: {
              status: 'UP',
              worker: { activeRunCount: 3 },
            },
            aiInvocation: { status: 'UP' },
          },
        },
      }),
    } as unknown as Response);

    render(<HealthPage />);
    await screen.findByText('quality-gateway');
    fireEvent.click(screen.getByRole('button', { name: '重新检查' }));

    await waitFor(() => expect(screen.getByText(/最近检查：/u)).toBeInTheDocument());
    expect(screen.getAllByText('异常').length).toBeGreaterThan(0);
    expect(screen.getByText('执行服务健康响应缺少 Worker 运行数量')).toBeInTheDocument();
    expect(screen.queryByText(/Worker：运行 0/u)).not.toBeInTheDocument();
  });
});
