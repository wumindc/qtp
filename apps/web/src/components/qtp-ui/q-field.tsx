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
  label?: ReactNode;
  errorMessage?: ReactNode;
  radius?: 'sm';
  variant?: QFieldVariant;
}

export type QTextFieldProps = Omit<InputProps, 'children' | 'variant'> & QFieldChromeProps;
export type QTextareaFieldProps = Omit<TextAreaProps, 'children' | 'variant'> & QFieldChromeProps;
export type QSelectFieldProps = Omit<SelectProps<QSelectOption>, 'children' | 'items' | 'variant'> &
  QFieldChromeProps & {
  options: QSelectOption[];
};

function resolveTextVariant(variant: QFieldVariant) {
  return variant === 'bordered' || variant === 'flat' ? 'primary' : variant;
}

/**
 * @author codex
 * Keeps text fields compact and consistent across QTP management screens.
 */
export function QTextField({ radius = 'sm', variant = 'bordered', ...props }: QTextFieldProps) {
  const { label, errorMessage, ...inputProps } = props;

  return (
    <TextField data-radius={radius} isInvalid={Boolean(errorMessage)} variant={resolveTextVariant(variant)}>
      {label ? <Label>{label}</Label> : null}
      <Input {...inputProps} />
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </TextField>
  );
}

export function QTextareaField({ radius = 'sm', variant = 'bordered', ...props }: QTextareaFieldProps) {
  const { label, errorMessage, ...textareaProps } = props;

  return (
    <TextField data-radius={radius} isInvalid={Boolean(errorMessage)} variant={resolveTextVariant(variant)}>
      {label ? <Label>{label}</Label> : null}
      <TextArea {...textareaProps} />
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </TextField>
  );
}

export function QSelectField({ radius = 'sm', variant = 'bordered', options, ...props }: QSelectFieldProps) {
  const { label, errorMessage, ...selectProps } = props;

  return (
    <Select aria-label={typeof label === 'string' ? label : undefined} data-radius={radius} variant={resolveTextVariant(variant)} {...selectProps}>
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
