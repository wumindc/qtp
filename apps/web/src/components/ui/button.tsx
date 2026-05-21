'use client';

import { Slot } from '@radix-ui/react-slot';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  icon?: ReactNode;
  isLoading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      asChild = false,
      children,
      className,
      disabled,
      icon,
      isLoading = false,
      size = 'md',
      type = 'button',
      variant = 'secondary',
      ...props
    },
    ref,
  ) => {
    const Component = asChild ? Slot : 'button';

    return (
      <Component
        className={cn('ui-button', `ui-button--${variant}`, `ui-button--${size}`, className)}
        disabled={!asChild ? disabled || isLoading : undefined}
        ref={ref}
        type={!asChild ? type : undefined}
        {...props}
      >
        {isLoading ? <Loader2 aria-hidden="true" className="ui-button__spinner" /> : icon}
        {children ? <span className="ui-button__label">{children}</span> : null}
      </Component>
    );
  },
);

Button.displayName = 'Button';
