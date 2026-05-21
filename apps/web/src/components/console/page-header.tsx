import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PageHeaderProps {
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  title: ReactNode;
}

export function PageHeader({ actions, breadcrumbs, className, description, eyebrow, meta, title }: PageHeaderProps) {
  return (
    <header className={cn('console-page-header', className)}>
      {breadcrumbs ? <div className="console-page-header__breadcrumbs">{breadcrumbs}</div> : null}
      <div className="console-page-header__row">
        <div className="console-page-header__copy">
          {eyebrow ? <div className="console-page-header__eyebrow">{eyebrow}</div> : null}
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
          {meta ? <div className="console-page-header__meta">{meta}</div> : null}
        </div>
        {actions ? <div className="console-page-header__actions">{actions}</div> : null}
      </div>
    </header>
  );
}
