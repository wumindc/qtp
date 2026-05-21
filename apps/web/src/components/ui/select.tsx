'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ConsoleSelectOption {
  disabled?: boolean;
  label: ReactNode;
  value: string;
}

export interface ConsoleSelectProps {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
  options: ConsoleSelectOption[];
  placeholder?: string;
  triggerClassName?: string;
  value: string;
}

/**
 * @author codex
 * Radix Select wrapper used by console forms and filters to avoid native dropdown behavior.
 */
export function ConsoleSelect({
  ariaLabel,
  className,
  disabled,
  onValueChange,
  options,
  placeholder = '请选择',
  triggerClassName,
  value,
}: ConsoleSelectProps) {
  return (
    <SelectPrimitive.Root disabled={disabled} value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger aria-label={ariaLabel} className={cn('ui-select-trigger', triggerClassName)}>
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className={cn('ui-select-content', className)} position="popper" sideOffset={6}>
          <SelectPrimitive.ScrollUpButton className="ui-select-scroll-button">
            <ChevronUp aria-hidden="true" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="ui-select-viewport">
            {options.map((option) => (
              <SelectPrimitive.Item className="ui-select-item" disabled={option.disabled} key={option.value} value={option.value}>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="ui-select-item-indicator">
                  <Check aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="ui-select-scroll-button">
            <ChevronDown aria-hidden="true" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
