import { CircleOff } from 'lucide-react';
import { type ReactNode } from 'react';
import { Button } from './button';
import { cn } from '@/lib/cn';

export interface EmptyStateProps {
  action?: ReactNode;
  className?: string;
  description?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
}

export function EmptyState({ action, className, description, icon, title }: EmptyStateProps) {
  return (
    <section className={cn('ui-empty-state', className)}>
      <div className="ui-empty-state__icon">{icon ?? <CircleOff aria-hidden="true" />}</div>
      <div className="ui-empty-state__copy">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      {typeof action === 'string' ? <Button variant="default">{action}</Button> : action}
    </section>
  );
}
