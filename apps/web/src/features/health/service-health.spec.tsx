import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HealthPage } from './service-health';

describe('HealthPage', () => {
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
      screen.getByText('http://127.0.0.1:8080/ai-quality-platform/api/business/health.do'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('http://127.0.0.1:3101/ai-quality-platform/health.do'),
    ).not.toBeInTheDocument();
  });
});
