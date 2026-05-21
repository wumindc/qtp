'use client';

import { Chip, Spinner } from '@heroui/react';
import type { ReactNode } from 'react';

type QStatusTone = 'success' | 'default' | 'danger' | 'warning';

interface QStatusChipProps {
  status: string;
  tone?: QStatusTone;
}

interface QStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

function resolveStatusTone(status: string, tone?: QStatusTone) {
  if (tone) {
    return tone;
  }

  return status === '启用' ? 'success' : 'default';
}

/**
 * @author codex
 * Maps common status labels to semantic HeroUI chip colors while staying feature-agnostic.
 */
export function QStatusChip({ status, tone }: QStatusChipProps) {
  return (
    <Chip className="qtp-status-chip" color={resolveStatusTone(status, tone)} size="sm" variant="soft">
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
