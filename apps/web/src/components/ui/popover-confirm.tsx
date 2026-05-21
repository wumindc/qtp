'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import { type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { Button } from './button';
import { cn } from '@/lib/cn';

export interface PopoverConfirmProps extends Omit<ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>, 'content' | 'title'> {
  actionLabel?: ReactNode;
  cancelLabel?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  onConfirm: () => void;
  title?: ReactNode;
}

export function PopoverConfirm({
  actionLabel = '确认',
  align = 'end',
  cancelLabel = '取消',
  children,
  className,
  description,
  onConfirm,
  sideOffset = 8,
  title = '确认操作',
  ...props
}: PopoverConfirmProps) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>{children}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          className={cn('ui-popover-confirm', className)}
          role="dialog"
          sideOffset={sideOffset}
          {...props}
        >
          <div className="ui-popover-confirm__copy">
            <strong>{title}</strong>
            {description ? <p>{description}</p> : null}
          </div>
          <div className="ui-popover-confirm__actions">
            <PopoverPrimitive.Close asChild>
              <Button size="sm" variant="secondary">
                {cancelLabel}
              </Button>
            </PopoverPrimitive.Close>
            <PopoverPrimitive.Close asChild>
              <Button onClick={onConfirm} size="sm" variant="danger">
                {actionLabel}
              </Button>
            </PopoverPrimitive.Close>
          </div>
          <PopoverPrimitive.Arrow className="ui-popover-confirm__arrow" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
