import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ToolbarProps {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  filters?: ReactNode;
  search?: ReactNode;
}

export function Toolbar({ actions, children, className, filters, search }: ToolbarProps) {
  return (
    <div className={cn('console-toolbar', className)}>
      <div className="console-toolbar__main">
        {search ? <div className="console-toolbar__search">{search}</div> : null}
        {filters ? <div className="console-toolbar__filters">{filters}</div> : null}
        {children}
      </div>
      {actions ? <div className="console-toolbar__actions">{actions}</div> : null}
    </div>
  );
}
