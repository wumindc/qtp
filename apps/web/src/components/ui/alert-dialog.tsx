'use client';

import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { Button } from './button';
import { cn } from '@/lib/cn';

export const AlertDialogRoot = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogCancel = AlertDialogPrimitive.Cancel;
export const AlertDialogAction = AlertDialogPrimitive.Action;

export interface AlertDialogContentProps extends Omit<ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>, 'title'> {
  actionLabel?: ReactNode;
  cancelLabel?: ReactNode;
  description?: ReactNode;
  onAction?: () => void;
  title: ReactNode;
  variant?: 'danger' | 'primary';
}

export function AlertDialogContent({
  actionLabel = '确认',
  cancelLabel = '取消',
  children,
  className,
  description,
  onAction,
  title,
  variant = 'danger',
  ...props
}: AlertDialogContentProps) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="ui-alert-dialog__overlay" />
      <AlertDialogPrimitive.Content className={cn('ui-alert-dialog__content', className)} {...props}>
        <header className="ui-alert-dialog__header">
          <AlertDialogPrimitive.Title className="ui-alert-dialog__title">{title}</AlertDialogPrimitive.Title>
          {description ? (
            <AlertDialogPrimitive.Description className="ui-alert-dialog__description">
              {description}
            </AlertDialogPrimitive.Description>
          ) : null}
        </header>
        {children ? <div className="ui-alert-dialog__body">{children}</div> : null}
        <footer className="ui-alert-dialog__footer">
          <AlertDialogPrimitive.Cancel asChild>
            <Button variant="secondary">{cancelLabel}</Button>
          </AlertDialogPrimitive.Cancel>
          <AlertDialogPrimitive.Action asChild onClick={onAction}>
            <Button variant={variant === 'danger' ? 'danger' : 'primary'}>{actionLabel}</Button>
          </AlertDialogPrimitive.Action>
        </footer>
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  );
}
