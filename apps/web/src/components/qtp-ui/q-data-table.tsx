'use client';

import { Table, type TableProps } from '@heroui/react';
import type { ReactNode } from 'react';

export type QDataTableProps = Omit<TableProps, 'children' | 'className'> & {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  children: ReactNode;
  className?: string;
  radius?: 'sm';
  removeWrapper?: boolean;
};

function getTableClassName(radius: QDataTableProps['radius'], className?: string) {
  return ['qtp-data-table', radius ? `qtp-data-table--radius-${radius}` : null, className].filter(Boolean).join(' ');
}

/**
 * @author codex
 * Provides a HeroUI table entrypoint for the first POC; complex features can later move inside this wrapper.
 */
export function QDataTable({ children, className, radius = 'sm', removeWrapper = false, ...tableProps }: QDataTableProps) {
  const { 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, ...rootProps } = tableProps;
  const content = (
    <Table.Content aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} className="qtp-data-table__content">
      {children}
    </Table.Content>
  );

  return (
    <Table aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} className={getTableClassName(radius, className)} role="table" variant="secondary" {...rootProps}>
      {removeWrapper ? content : <Table.ScrollContainer className="qtp-data-table__scroll">{content}</Table.ScrollContainer>}
    </Table>
  );
}
