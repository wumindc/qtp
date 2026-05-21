import { Chip, Spinner } from '@heroui/react';
import type { ReactNode } from 'react';
import type { StatusLabel } from '@/features/models/types';

interface QStatusChipProps {
  status: StatusLabel;
}

interface QStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * @author codex
 * Maps business status labels to semantic HeroUI chip colors.
 */
export function QStatusChip({ status }: QStatusChipProps) {
  return (
    <Chip color={status === '启用' ? 'success' : 'default'} data-radius="sm" size="sm" variant="soft">
      {status}
    </Chip>
  );
}

export function QEmptyState({ title, description, action }: QStateProps) {
  return (
    <div className="qtp-empty-state">
      <strong>{title}</strong>
      {description ? <span>{description}</span> : null}
      {action}
    </div>
  );
}

export function QErrorState({ title, description, action }: QStateProps) {
  return (
    <div className="qtp-error-state" role="alert">
      <strong>{title}</strong>
      {description ? <span>{description}</span> : null}
      {action}
    </div>
  );
}

export function QLoadingState({ label = '加载中' }: { label?: string }) {
  return (
    <div className="qtp-loading-state" role="status">
      <Spinner size="sm" />
      <span>{label}</span>
    </div>
  );
}
