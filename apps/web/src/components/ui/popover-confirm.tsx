'use client';
/**
 * 删除确认气泡 — 包裹触发器，点击弹出确认/取消，确认后才执行操作
 * @author Antigravity/Gemini
 */
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { AlertTriangle } from 'lucide-react';
import { type ReactNode } from 'react';
import { Button } from './button';
import { cn } from '@/lib/cn';

export interface PopoverConfirmProps {
  /** 触发器（可用 trigger 或 children 传入） */
  children?: ReactNode;
  trigger?: ReactNode;
  title?: string;
  description?: string;
  /** 确认按钮文字（alias: actionLabel）*/
  confirmLabel?: string;
  actionLabel?: string;
  cancelLabel?: string;
  /** 确认后的回调 */
  onConfirm: () => void;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export function PopoverConfirm({
  children,
  trigger,
  title = '确认删除',
  description = '此操作不可撤销，请谨慎操作。',
  confirmLabel,
  actionLabel,
  cancelLabel = '取消',
  onConfirm,
  align = 'end',
  className,
}: PopoverConfirmProps) {
  const triggerEl = trigger ?? children;
  const confirmText = confirmLabel ?? actionLabel ?? '确认删除';

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>{triggerEl}</PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={8}
          className={cn(
            'bg-popover text-popover-foreground z-50 w-64 rounded-lg border p-4 shadow-lg outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
            className,
          )}
        >
          {/* 图标 + 文案 */}
          <div className="flex items-start gap-3 mb-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold leading-none">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2">
            <PopoverPrimitive.Close asChild>
              <Button size="sm" variant="outline">{cancelLabel}</Button>
            </PopoverPrimitive.Close>
            <PopoverPrimitive.Close asChild>
              <Button
                size="sm"
                variant="destructive"
                onClick={onConfirm}
              >
                {confirmText}

              </Button>
            </PopoverPrimitive.Close>
          </div>

          <PopoverPrimitive.Arrow className="fill-border" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
