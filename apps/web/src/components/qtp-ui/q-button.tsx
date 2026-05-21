import { Button, type ButtonProps } from '@heroui/react';

type QButtonVariant = ButtonProps['variant'] | 'solid' | 'flat';

export type QButtonProps = Omit<ButtonProps, 'variant'> & {
  color?: 'primary' | 'danger' | 'default';
  isLoading?: boolean;
  radius?: 'sm';
  variant?: QButtonVariant;
};

/**
 * @author codex
 * Provides the project-level button entrypoint around HeroUI's button.
 */
export function QButton({ radius = 'sm', variant = 'solid', color = 'primary', ...props }: QButtonProps) {
  const { isLoading, isDisabled, ...buttonProps } = props;
  const resolvedVariant = variant === 'solid' ? 'primary' : variant === 'flat' ? 'secondary' : variant;

  return <Button data-color={color} data-radius={radius} isDisabled={isDisabled || isLoading} variant={resolvedVariant} {...buttonProps} />;
}
