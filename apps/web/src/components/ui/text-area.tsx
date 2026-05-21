'use client';

import {
  forwardRef,
  useState,
  type FormEvent,
  type InputEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: ReactNode;
  hint?: ReactNode;
  label?: ReactNode;
}

/**
 * @author codex
 * Shared textarea field so long-form inputs use the same spacing, focus and error states as text inputs.
 */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, disabled, error, hint, id, label, onInput, onInvalid, readOnly, required, ...props }, ref) => {
    const [localError, setLocalError] = useState('');
    const shownError = error ?? localError;
    const describedBy =
      [hint ? `${id}-hint` : null, shownError ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;

    const handleInvalid = (event: FormEvent<HTMLTextAreaElement>) => {
      onInvalid?.(event);
      event.preventDefault();
      const message = event.currentTarget.validity.valueMissing
        ? '请填写此字段。'
        : event.currentTarget.validationMessage;
      setLocalError(message);
    };

    const handleInput = (event: InputEvent<HTMLTextAreaElement>) => {
      setLocalError('');
      onInput?.(event);
    };

    return (
      <label
        className={cn('ui-field', (disabled || readOnly) && 'is-readonly', className)}
        data-required={required ? 'true' : undefined}
      >
        {label ? (
          <span className="ui-field__label">{label}</span>
        ) : null}
        <textarea
          aria-describedby={describedBy}
          aria-invalid={Boolean(shownError) || undefined}
          aria-required={required || undefined}
          className={cn('ui-text-area', shownError && 'is-invalid', disabled && 'is-disabled', readOnly && 'is-readonly')}
          disabled={disabled}
          id={id}
          readOnly={readOnly}
          ref={ref}
          required={required}
          onInput={handleInput}
          onInvalid={handleInvalid}
          {...props}
        />
        {hint ? (
          <span className="ui-field__hint" id={id ? `${id}-hint` : undefined}>
            {hint}
          </span>
        ) : null}
        {shownError ? (
          <span className="ui-field__error" id={id ? `${id}-error` : undefined}>
            {shownError}
          </span>
        ) : null}
      </label>
    );
  },
);

TextArea.displayName = 'TextArea';
