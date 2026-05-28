'use client';
/**
 * Toaster (Sonner) 组件
 * @author Antigravity/Gemini
 * @author codex
 * @author Antigravity/Claude-Sonnet-4.6
 */
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

const Toaster = ({
  closeButton = false,
  duration = 3500,
  // top-center 需要 sonner 内部固定宽度才能居中，不覆盖 width/--width
  position = 'top-center',
  style,
  toastOptions,
  ...props
}: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      closeButton={closeButton}
      duration={duration}
      position={position}
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        ...toastOptions,
        style: {
          // 只限制最大宽度，不设 width/max-content，避免干扰居中定位
          maxWidth: 'min(420px, calc(100vw - 32px))',
          padding: '10px 12px',
          minHeight: '40px',
          ...toastOptions?.style,
        },
      }}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
          // 不覆盖 --width，让 sonner 使用内部默认值以确保 top-center 正确居中
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
