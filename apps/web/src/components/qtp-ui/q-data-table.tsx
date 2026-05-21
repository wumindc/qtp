import { Table, type TableProps } from '@heroui/react';

export type QDataTableProps = TableProps & {
  radius?: 'sm';
  removeWrapper?: boolean;
};

/**
 * @author codex
 * Provides a HeroUI table entrypoint for the first POC; complex features can later move inside this wrapper.
 */
export function QDataTable(props: QDataTableProps) {
  const { radius = 'sm', removeWrapper = false, ...tableProps } = props;

  return <Table data-radius={radius} data-remove-wrapper={removeWrapper} {...tableProps} />;
}
