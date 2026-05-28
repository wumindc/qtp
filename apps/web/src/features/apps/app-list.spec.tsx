/**
 * AI 应用列表页测试
 * @author codex
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppListPage } from './app-list';
import { loadApps, saveApp } from './api/app-api';
import { toast } from 'sonner';
import type { App } from './types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('./api/app-api', () => ({
  loadApps: vi.fn(),
  saveApp: vi.fn(),
  deleteApp: vi.fn(),
  changeAppStatus: vi.fn(),
}));

vi.mock('./app-form-dialog', () => ({
  AppFormDialog: ({ onSubmit }: { onSubmit: (data: unknown) => void }) => (
    <button
      type="button"
      onClick={() => onSubmit({
        appName: '网站对话助手',
        appType: 'CHAT',
        description: '',
        owner: '吴敏',
        status: 'ENABLED',
        protocol: {
          method: 'POST',
          url: '',
          headers: '{}',
          body: '{}',
          answerPath: '$.content',
          successExpr: '$.code == 0',
          streamEnabled: false,
        },
      })}
    >
      mock-submit-app
    </button>
  ),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('AppListPage', () => {
  beforeEach(() => {
    vi.mocked(loadApps).mockReset();
    vi.mocked(saveApp).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('shows the app owner as a compact badge beside status and type', async () => {
    vi.mocked(loadApps).mockResolvedValue([
      {
        appCode: 'c',
        appName: '北京信用小京灵',
        appType: 'CHAT',
        description: '',
        owner: '吴敏',
        status: 'ENABLED',
        protocol: {
          method: 'POST',
          url: 'http://example.com/chat.do',
          headers: '{}',
          body: '{}',
          answerPath: '$.content',
          successExpr: '$.code == 0',
          streamEnabled: false,
          appConcurrency: 3,
        },
        stats: {
          caseCount: 5,
          planCount: 3,
          lastPassRate: 40,
        },
        icon: {
          iconKey: 'brain',
          themeKey: 'emerald',
          variantKey: 'ring',
        },
      },
    ]);

    render(<AppListPage />);

    expect(await screen.findByText('吴敏')).toBeInTheDocument();
    expect(screen.getByLabelText('应用图标：brain')).toHaveAttribute('data-icon-key', 'brain');
    expect(screen.queryByText('负责人：吴敏')).not.toBeInTheDocument();
  });

  it('shows the concrete backend error when creating an app fails', async () => {
    vi.mocked(loadApps).mockResolvedValue([]);
    vi.mocked(saveApp).mockRejectedValue(new Error('请填写应用名称'));

    render(<AppListPage />);

    fireEvent.click(await screen.findByText('mock-submit-app'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('请填写应用名称');
    });
  });

  it('does not render malformed app cards with default protocol or zero metrics', async () => {
    vi.mocked(loadApps).mockResolvedValue([
      {
        appCode: 'bad-app',
        appName: '坏应用',
        appType: 'CHAT',
        description: '',
        owner: '',
        status: 'ENABLED',
      } as unknown as App,
    ]);

    render(<AppListPage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('应用列表缺少应用协议配置', { id: 'app-list-load-error' });
    });
    expect(screen.queryByText('坏应用')).not.toBeInTheDocument();
    expect(screen.queryByText('POST 未配置接口')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
