'use client';
/**
 * Toaster (Sonner) 组件 — 参照 design-deploy
 * @author Antigravity/Gemini
 * @author codex
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
          width: 'max-content',
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
          '--width': 'max-content',
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
