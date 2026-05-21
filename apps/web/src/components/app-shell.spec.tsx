import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from './app-shell';

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
    expect(screen.queryByText('测试用例')).not.toBeInTheDocument();
    expect(screen.queryByText('测试计划')).not.toBeInTheDocument();
    expect(screen.queryByText('执行记录')).not.toBeInTheDocument();
    expect(screen.getByText('服务健康')).toBeInTheDocument();
    expect(screen.getByText('页面内容')).toBeInTheDocument();
  });

  it('switches the sidebar into an app workspace on app detail pages', () => {
    render(
      <AppShell currentPath="/ai-quality-platform/apps/demo_credit_assistant">
        <main>应用详情</main>
      </AppShell>,
    );

    expect(screen.getByRole('link', { name: '返回 AI 应用列表' })).toHaveAttribute('href', '/ai-quality-platform/apps');
    expect(screen.getByText('返回 AI 应用')).toBeInTheDocument();
    expect(screen.getByText('demo_credit_assistant')).toBeInTheDocument();
    expect(screen.getByText('概览').closest('a')).toHaveAttribute(
      'href',
      '/ai-quality-platform/apps/demo_credit_assistant#overview',
    );
    expect(screen.getByText('接入配置').closest('a')).toHaveAttribute(
      'href',
      '/ai-quality-platform/apps/demo_credit_assistant#protocol',
    );
    expect(screen.getByText('测试用例').closest('a')).toHaveAttribute(
      'href',
      '/ai-quality-platform/apps/demo_credit_assistant#cases',
    );
    expect(screen.getByText('测试计划').closest('a')).toHaveAttribute(
      'href',
      '/ai-quality-platform/apps/demo_credit_assistant#plans',
    );
    expect(screen.getByText('模型中心').closest('a')).toHaveAttribute('href', '/ai-quality-platform/providers');
    expect(screen.getByText('预置用例').closest('a')).toHaveAttribute('href', '/ai-quality-platform/cases');
    expect(screen.getByText('服务健康').closest('a')).toHaveAttribute('href', '/ai-quality-platform/health');
    expect(screen.getByText('应用详情')).toBeInTheDocument();
  });
});
