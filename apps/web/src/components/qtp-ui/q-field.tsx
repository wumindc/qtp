'use client';

import {
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
  type InputProps,
  type SelectProps,
  type TextAreaProps,
} from '@heroui/react';
import type { ReactNode } from 'react';

interface QSelectOption {
  label: string;
  value: string;
}

type QFieldVariant = 'bordered' | 'flat' | 'primary' | 'secondary';

interface QFieldChromeProps {
  className?: string;
  label?: ReactNode;
  errorMessage?: ReactNode;
  radius?: 'sm';
  variant?: QFieldVariant;
}

export type QTextFieldProps = Omit<InputProps, 'children' | 'className' | 'variant'> & QFieldChromeProps;
export type QTextareaFieldProps = Omit<TextAreaProps, 'children' | 'className' | 'variant'> & QFieldChromeProps;
export type QSelectFieldProps = Omit<SelectProps<QSelectOption>, 'children' | 'className' | 'items' | 'variant'> &
  QFieldChromeProps & {
  options: QSelectOption[];
};

function resolveTextVariant(variant: QFieldVariant) {
  return variant === 'bordered' || variant === 'flat' ? 'primary' : variant;
}

function getFieldClassName(radius: QFieldChromeProps['radius'], className?: string) {
  return ['qtp-field', radius ? `qtp-field--radius-${radius}` : null, className].filter(Boolean).join(' ');
}

/**
 * @author codex
 * Keeps text fields compact and consistent across QTP management screens.
 */
export function QTextField({ radius = 'sm', variant = 'bordered', ...props }: QTextFieldProps) {
  const { className, label, errorMessage, ...inputProps } = props;

  return (
    <TextField className={getFieldClassName(radius, className)} isInvalid={Boolean(errorMessage)} variant={resolveTextVariant(variant)}>
      {label ? <Label>{label}</Label> : null}
      <Input {...inputProps} />
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </TextField>
  );
}

export function QTextareaField({ radius = 'sm', variant = 'bordered', ...props }: QTextareaFieldProps) {
  const { className, label, errorMessage, ...textareaProps } = props;

  return (
    <TextField className={getFieldClassName(radius, className)} isInvalid={Boolean(errorMessage)} variant={resolveTextVariant(variant)}>
      {label ? <Label>{label}</Label> : null}
      <TextArea {...textareaProps} />
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </TextField>
  );
}

export function QSelectField({ radius = 'sm', variant = 'bordered', options, ...props }: QSelectFieldProps) {
  const { className, label, errorMessage, ...selectProps } = props;

  return (
    <Select
      aria-label={typeof label === 'string' ? label : undefined}
      className={getFieldClassName(radius, className)}
      variant={resolveTextVariant(variant)}
      {...selectProps}
    >
      {label ? <Label>{label}</Label> : null}
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item id={option.value} key={option.value} textValue={option.label}>
              {option.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </Select>
  );
}
