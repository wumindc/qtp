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
  error?: ReactNode;
  hint?: ReactNode;
  label?: ReactNode;
  onValueChange: (value: string) => void;
  options: ConsoleSelectOption[];
  placeholder?: string;
  required?: boolean;
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
  error,
  hint,
  label,
  onValueChange,
  options,
  placeholder = '请选择',
  required,
  triggerClassName,
  value,
}: ConsoleSelectProps) {
  const describedBy =
    [hint ? `${ariaLabel}-hint` : null, error ? `${ariaLabel}-error` : null].filter(Boolean).join(' ') || undefined;
  const select = (
    <SelectPrimitive.Root disabled={disabled} value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        aria-describedby={describedBy}
        aria-invalid={Boolean(error) || undefined}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        className={cn('ui-select-trigger', error && 'is-invalid', triggerClassName)}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="ui-select-content" position="popper" sideOffset={6}>
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

  if (!label && !hint && !error) return select;

  return (
    <label className={cn('ui-field', disabled && 'is-readonly', className)} data-has-meta="true" data-required={required ? 'true' : undefined}>
      {label ? <span className="ui-field__label">{label}</span> : null}
      {select}
      {hint ? (
        <span className="ui-field__hint" id={ariaLabel ? `${ariaLabel}-hint` : undefined}>
          {hint}
        </span>
      ) : null}
      <span className="ui-field__error" id={ariaLabel ? `${ariaLabel}-error` : undefined}>
        {error}
      </span>
    </label>
  );
}
