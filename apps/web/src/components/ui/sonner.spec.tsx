/**
 * 全局提醒组件测试
 * @author codex
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Toaster } from './sonner';

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

vi.mock('sonner', () => ({
  Toaster: ({
    closeButton,
    position,
    duration,
    style,
    toastOptions,
  }: {
    closeButton?: boolean;
    position?: string;
    duration?: number;
    style?: React.CSSProperties;
    toastOptions?: { style?: React.CSSProperties };
  }) => (
    <div
      data-close-button={String(closeButton)}
      data-duration={String(duration)}
      data-toast-max-width={String(toastOptions?.style?.maxWidth)}
      data-position={position}
      data-toast-padding={String(toastOptions?.style?.padding)}
      data-toast-width={String(toastOptions?.style?.width)}
      data-width={String(style?.['--width' as keyof React.CSSProperties])}
    >
      global toaster
    </div>
  ),
}));

describe('Toaster', () => {
  it('defaults global notifications to non-blocking placement without a close button', () => {
    render(<Toaster />);

    const toaster = screen.getByText('global toaster');
    expect(toaster).toHaveAttribute('data-close-button', 'false');
    expect(toaster).toHaveAttribute('data-position', 'top-center');
    expect(toaster).toHaveAttribute('data-duration', '3500');
    expect(toaster).toHaveAttribute('data-width', 'max-content');
    expect(toaster).toHaveAttribute('data-toast-width', 'max-content');
    expect(toaster).toHaveAttribute('data-toast-max-width', 'min(420px, calc(100vw - 32px))');
    expect(toaster).toHaveAttribute('data-toast-padding', '10px 12px');
  });
});
