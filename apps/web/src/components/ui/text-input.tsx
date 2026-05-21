'use client';

import {
  forwardRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type InputEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  error?: ReactNode;
  hint?: ReactNode;
  label?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ className, disabled, error, hint, id, label, onInput, onInvalid, prefix, readOnly, required, suffix, ...props }, ref) => {
    const [localError, setLocalError] = useState('');
    const shownError = error ?? localError;
    const reservesMeta = Boolean(label || hint || required || shownError);
    const describedBy =
      [hint ? `${id}-hint` : null, shownError ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;

    const handleInvalid = (event: FormEvent<HTMLInputElement>) => {
      onInvalid?.(event);
      event.preventDefault();
      const message = event.currentTarget.validity.valueMissing
        ? '请填写此字段。'
        : event.currentTarget.validationMessage;
      setLocalError(message);
    };

    const handleInput = (event: InputEvent<HTMLInputElement>) => {
      setLocalError('');
      onInput?.(event);
    };

    return (
      <label
        className={cn('ui-field', (disabled || readOnly) && 'is-readonly', className)}
        data-has-meta={reservesMeta ? 'true' : undefined}
        data-required={required ? 'true' : undefined}
      >
        {label ? (
          <span className="ui-field__label">{label}</span>
        ) : null}
        <span className={cn('ui-text-input', shownError && 'is-invalid', disabled && 'is-disabled', readOnly && 'is-readonly')}>
          {prefix ? <span className="ui-text-input__affix">{prefix}</span> : null}
          <input
            aria-describedby={describedBy}
            aria-invalid={Boolean(shownError) || undefined}
            aria-required={required || undefined}
            disabled={disabled}
            id={id}
            readOnly={readOnly}
            ref={ref}
            required={required}
            onInput={handleInput}
            onInvalid={handleInvalid}
            {...props}
          />
          {suffix ? <span className="ui-text-input__affix">{suffix}</span> : null}
        </span>
        {hint ? (
          <span className="ui-field__hint" id={id ? `${id}-hint` : undefined}>
            {hint}
          </span>
        ) : null}
        {reservesMeta ? (
          <span className="ui-field__error" id={id ? `${id}-error` : undefined}>
            {shownError}
          </span>
        ) : null}
      </label>
    );
  },
);

TextInput.displayName = 'TextInput';
