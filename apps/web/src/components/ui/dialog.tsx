'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { IconButton } from './icon-button';
import { cn } from '@/lib/cn';

export const DialogRoot = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export interface DialogContentProps extends Omit<ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, 'title'> {
  description?: ReactNode;
  footer?: ReactNode;
  showClose?: boolean;
  title?: ReactNode;
}

export function DialogContent({
  children,
  className,
  description,
  footer,
  showClose = true,
  title,
  ...props
}: DialogContentProps) {
  const hasBody = Boolean(children);
  const hasFooter = Boolean(footer);

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="ui-dialog__overlay" />
      <DialogPrimitive.Content
        className={cn('ui-dialog__content', className)}
        data-has-body={hasBody ? 'true' : 'false'}
        data-has-footer={hasFooter ? 'true' : 'false'}
        {...props}
      >
        {showClose ? (
          <DialogPrimitive.Close asChild>
            <IconButton className="ui-dialog__close" label="关闭弹窗" size="sm">
              <X aria-hidden="true" />
            </IconButton>
          </DialogPrimitive.Close>
        ) : null}
        {title || description ? (
          <header className="ui-dialog__header">
            {title ? <DialogPrimitive.Title className="ui-dialog__title">{title}</DialogPrimitive.Title> : null}
            {description ? (
              <DialogPrimitive.Description className="ui-dialog__description">{description}</DialogPrimitive.Description>
            ) : null}
          </header>
        ) : null}
        {hasBody ? <div className="ui-dialog__body">{children}</div> : null}
        {hasFooter ? <footer className="ui-dialog__footer">{footer}</footer> : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
