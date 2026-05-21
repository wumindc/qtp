'use client';

import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Tooltip } from './tooltip';
import { cn } from '@/lib/cn';

type IconButtonVariant = 'secondary' | 'ghost' | 'danger' | 'outline';
type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  label: string;
  size?: IconButtonSize;
  tooltip?: ReactNode;
  variant?: IconButtonVariant;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ asChild = false, children, className, label, size = 'md', tooltip, type = 'button', variant = 'ghost', ...props }, ref) => {
    const Component = asChild ? Slot : 'button';
    const button = (
      <Component
        aria-label={label}
        className={cn('ui-icon-button', `ui-icon-button--${variant}`, `ui-icon-button--${size}`, className)}
        ref={ref}
        title={props.title ?? label}
        type={!asChild ? type : undefined}
        {...props}
      >
        {children}
      </Component>
    );

    return tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button;
  },
);

IconButton.displayName = 'IconButton';
