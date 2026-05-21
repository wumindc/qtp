'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const TooltipProvider = TooltipPrimitive.Provider;

export interface TooltipProps extends Omit<ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>, 'content'> {
  children: ReactNode;
  content: ReactNode;
  delayDuration?: number;
}

export function Tooltip({ children, className, content, delayDuration = 300, sideOffset = 6, ...props }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content className={cn('ui-tooltip', className)} sideOffset={sideOffset} {...props}>
            {content}
            <TooltipPrimitive.Arrow className="ui-tooltip__arrow" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
