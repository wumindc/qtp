'use client';

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type Row,
  type SortingState,
  type Table as TanstackTable,
  type VisibilityState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from './button';
import { EmptyState } from './empty-state';
import { cn } from '@/lib/cn';

export interface DataTableProps<TData> {
  className?: string;
  columns: ColumnDef<TData>[];
  data: TData[];
  emptyState?: ReactNode;
  getRowClassName?: (row: Row<TData>) => string | undefined;
  globalFilter?: string;
  onRowClick?: (row: Row<TData>) => void;
  pageSize?: number;
  renderToolbar?: (table: TanstackTable<TData>) => ReactNode;
}

export function DataTable<TData>({
  className,
  columns,
  data,
  emptyState,
  getRowClassName,
  globalFilter,
  onRowClick,
  pageSize = 10,
  renderToolbar,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const memoizedColumns = useMemo(() => columns, [columns]);
  const memoizedData = useMemo(() => data, [data]);

  const table = useReactTable({
    columns: memoizedColumns,
    data: memoizedData,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: { pagination: { pageSize } },
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
    state: { columnFilters, columnVisibility, globalFilter, sorting },
  });

  const rows = table.getRowModel().rows;
  const columnCount = table.getVisibleLeafColumns().length;

  return (
    <div className={cn('ui-data-table', className)}>
      {renderToolbar ? <div className="ui-data-table__toolbar">{renderToolbar(table)}</div> : null}
      <div className="ui-data-table__viewport">
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sortable = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();

                  return (
                    <th colSpan={header.colSpan} key={header.id} style={{ width: header.getSize() }}>
                      {header.isPlaceholder ? null : (
                        <button
                          className={cn('ui-data-table__sort', sortable && 'is-sortable')}
                          disabled={!sortable}
                          onClick={header.column.getToggleSortingHandler()}
                          type="button"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortable ? (
                            sorted === 'asc' ? (
                              <ChevronUp aria-hidden="true" />
                            ) : sorted === 'desc' ? (
                              <ChevronDown aria-hidden="true" />
                            ) : (
                              <ChevronsUpDown aria-hidden="true" />
                            )
                          ) : null}
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr
                  className={cn(onRowClick && 'is-clickable', getRowClassName?.(row))}
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columnCount}>
                  {emptyState ?? <EmptyState title="暂无数据" description="调整筛选条件后再试一次。" />}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {table.getPageCount() > 1 ? (
        <div className="ui-data-table__pagination">
          <span>
            第 {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} 页
          </span>
          <div>
            <Button disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} size="sm" variant="secondary">
              上一页
            </Button>
            <Button disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} size="sm" variant="secondary">
              下一页
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
