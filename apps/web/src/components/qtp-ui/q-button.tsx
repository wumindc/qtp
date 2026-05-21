'use client';

import { Button, type ButtonProps } from '@heroui/react';
import type { ReactNode } from 'react';

type QButtonVariant = ButtonProps['variant'] | 'solid' | 'flat';

export type QButtonProps = Omit<ButtonProps, 'children' | 'className' | 'variant'> & {
  children?: ReactNode;
  className?: string;
  color?: 'primary' | 'danger' | 'default';
  isLoading?: boolean;
  radius?: 'sm';
  variant?: QButtonVariant;
};

function resolveButtonVariant(color: QButtonProps['color'], variant: QButtonVariant) {
  if (variant === 'flat' || variant === 'secondary') {
    return 'secondary';
  }

  if (variant === 'solid') {
    return color === 'danger' ? 'danger' : 'primary';
  }

  return variant;
}

function getButtonClassName(radius: QButtonProps['radius'], className?: string) {
  return ['qtp-button', radius ? `qtp-button--radius-${radius}` : null, className].filter(Boolean).join(' ');
}

/**
 * @author codex
 * Provides the project-level button entrypoint around HeroUI's button.
 */
export function QButton({ className, radius = 'sm', variant = 'solid', color = 'primary', ...props }: QButtonProps) {
  const { children, isLoading, isDisabled, ...buttonProps } = props;
  const resolvedVariant = resolveButtonVariant(color, variant);

  return (
    <Button
      aria-busy={isLoading || undefined}
      className={getButtonClassName(radius, className)}
      data-qtp-variant={resolvedVariant}
      isDisabled={isDisabled || isLoading}
      variant={resolvedVariant}
      {...buttonProps}
    >
      {isLoading ? (
        <span aria-hidden="true" className="qtp-button__loading">
          加载中
        </span>
      ) : null}
      {children}
    </Button>
  );
}
