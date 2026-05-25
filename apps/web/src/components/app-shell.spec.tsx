/**
 * AppShell 组件测试
 * @author Antigravity/Gemini-2.5-Pro
 * @author codex
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/ai-quality-platform'),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

describe('AppShell', () => {
  it('renders the AI quality platform navigation', () => {
    render(
      <AppShell>
        <main>页面内容</main>
      </AppShell>,
    );

    expect(screen.getByText('AI 质量平台')).toBeInTheDocument();
    expect(screen.getByText('工作台')).toBeInTheDocument();
    expect(screen.getByText('AI 应用').closest('a')).toHaveAttribute('href', '/ai-quality-platform/apps');
    expect(screen.getByText('预置用例').closest('a')).toHaveAttribute('href', '/ai-quality-platform/cases');
    expect(screen.getByText('模型中心').closest('a')).toHaveAttribute('href', '/ai-quality-platform/providers');
    expect(screen.getByText('服务健康')).toBeInTheDocument();
    expect(screen.getByText('页面内容')).toBeInTheDocument();
  });
});
