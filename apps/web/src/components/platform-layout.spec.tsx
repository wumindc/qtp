import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformLayout } from './platform-layout';

const replaceMock = vi.fn();
let pathname = '/ai-quality-platform/apps';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock('./app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

describe('PlatformLayout', () => {
  beforeEach(() => {
    window.localStorage.clear();
    replaceMock.mockReset();
    pathname = '/ai-quality-platform/apps';
  });

  it('redirects private pages to login when no token is stored', async () => {
    render(<PlatformLayout><span>私有内容</span></PlatformLayout>);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/ai-quality-platform/login'));
    expect(screen.queryByText('私有内容')).not.toBeInTheDocument();
  });

  it('renders private pages when a signed token is stored', async () => {
    window.localStorage.setItem('qtp-auth-token', 'signed-token');

    render(<PlatformLayout><span>私有内容</span></PlatformLayout>);

    expect(await screen.findByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByText('私有内容')).toBeInTheDocument();
  });

  it('keeps the login page public', () => {
    pathname = '/ai-quality-platform/login';

    render(<PlatformLayout><span>登录内容</span></PlatformLayout>);

    expect(replaceMock).not.toHaveBeenCalled();
    expect(screen.getByText('登录内容')).toBeInTheDocument();
  });
});
