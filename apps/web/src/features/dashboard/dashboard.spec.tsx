import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardPage } from './dashboard';

describe('DashboardPage', () => {
  it('renders quality metrics', () => {
    render(<DashboardPage />);

    expect(screen.getByText('AI 应用数')).toBeInTheDocument();
    expect(screen.getByText('暂无 AI 应用')).toBeInTheDocument();
    expect(screen.getByText('待复核')).toBeInTheDocument();
    expect(screen.getByText('暂无待复核结果')).toBeInTheDocument();
  });
});
