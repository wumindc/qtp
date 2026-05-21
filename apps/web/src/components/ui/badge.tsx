import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type BadgeTone = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'violet';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  icon?: ReactNode;
  tone?: BadgeTone;
}

export function Badge({ children, className, icon, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span className={cn('ui-badge', `ui-badge--${tone}`, className)} {...props}>
      {icon ? <span className="ui-badge__icon">{icon}</span> : null}
      <span>{children}</span>
    </span>
  );
}
