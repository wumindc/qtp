import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HealthPage } from './service-health';

describe('HealthPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists all backend services planned for local development', () => {
    render(<HealthPage />);

    expect(screen.getByText('quality-business-service')).toBeInTheDocument();
    expect(screen.getByText('quality-case-service')).toBeInTheDocument();
    expect(screen.getByText('quality-plan-service')).toBeInTheDocument();
    expect(screen.getByText('quality-execution-service')).toBeInTheDocument();
    expect(screen.getByText('quality-ai-service')).toBeInTheDocument();
    expect(screen.getByText('quality-review-service')).toBeInTheDocument();
    expect(screen.getByText('quality-statistics-service')).toBeInTheDocument();
    expect(screen.getByText('quality-system-service')).toBeInTheDocument();
  });

  it('uses unified gateway health URLs instead of internal service ports', () => {
    render(<HealthPage />);

    expect(
      screen.getByText('http://localhost:8080/ai-quality-platform/api/business/health.do'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('http://127.0.0.1:3101/ai-quality-platform/health.do'),
    ).not.toBeInTheDocument();
  });

  it('checks real gateway health URLs when the recheck button is clicked', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { status: 'UP' } }),
    } as Response);

    render(<HealthPage />);
    fireEvent.click(screen.getByRole('button', { name: '重新检查' }));

    await waitFor(() => expect(screen.getByText(/最近检查：/u)).toBeInTheDocument());
    expect(screen.getAllByText('UP')).toHaveLength(9);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/ai-quality-platform/api/business/health.do',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });
});
