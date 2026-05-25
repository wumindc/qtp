'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { getGatewayApiUrl, type BackendServiceKey } from '@ai-quality-platform/shared-config';
import { ConsoleSelect, DialogContent, DialogRoot, TextArea, TextInput } from '@/components/ui';

type ConsoleFieldType = 'text' | 'textarea' | 'select';

export interface ManagementConsoleRecord {
  id: string;
  status: string;
  [key: string]: unknown;
}

export interface ManagementConsoleColumn {
  key: string;
  label: string;
  width?: string;
}

export interface ManagementConsoleField {
  key: string;
  label: string;
  type?: ConsoleFieldType;
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

export interface ManagementConsolePageProps {
  title: string;
  description: string;
  columns: ManagementConsoleColumn[];
  fields: ManagementConsoleField[];
  initialRows: ManagementConsoleRecord[];
  statusOptions: string[];
  searchPlaceholder?: string;
  createLabel?: string;
  viewMode?: 'table' | 'cards';
  cardLayout?: ManagementConsoleCardLayout;
  actions?: ManagementConsoleActions;
  getDetailHref?: (row: ManagementConsoleRecord) => string;
  detailHrefBase?: string;
  detailHrefField?: string;
  rowActions?: ManagementConsoleRowAction[];
}

export interface ManagementConsoleCardLayout {
  titleKey: string;
  subtitleKey?: string;
  metaKeys?: string[];
  descriptionKeys?: string[];
  primaryActionLabel?: string;
}

type DialogMode = 'create' | 'edit';

export interface ManagementConsoleActions {
  service: BackendServiceKey;
  createPath?: string;
  updatePath?: string;
  statusPath?: string;
  deletePath?: string;
  idParam: string;
  idField?: string;
  updateDataParam?: string;
  statusParam?: string;
  fieldMap: Record<string, string>;
  statusValueByLabel?: Record<string, string | boolean>;
}

export interface ManagementConsoleRowAction {
  label: string;
  service: BackendServiceKey;
  path: string;
  idParam: string;
  idField?: string;
  successMessage: string;
}

const EMPTY_FORM: ManagementConsoleRecord = { id: '', status: '' };

function buildFormState(fields: ManagementConsoleField[], statusOptions: string[], seed?: ManagementConsoleRecord) {
  const state: ManagementConsoleRecord = { ...EMPTY_FORM, status: statusOptions[0] ?? '' };
  fields.forEach((field) => {
    state[field.key] = seed?.[field.key] ?? field.options?.[0] ?? '';
  });
  return { ...state, ...seed };
}

function mapActionFields(
  formState: ManagementConsoleRecord,
  fieldMap: Record<string, string>,
  statusValueByLabel: Record<string, string | boolean> = {},
) {
  return Object.entries(fieldMap).reduce<Record<string, string | boolean>>((payload, [requestKey, formKey]) => {
    const formValue = String(formState[formKey] ?? '');
    payload[requestKey] = statusValueByLabel[formValue] ?? formValue;
    return payload;
  }, {});
}

/**
 * @author codex
 * Reusable client-side management console with local CRUD interactions for route-level composition.
 */
export function ManagementConsolePage({
  title,
  description,
  columns,
  fields,
  initialRows,
  statusOptions,
  searchPlaceholder = '搜索名称、编号或负责人',
  createLabel = '新建',
  viewMode = 'table',
  cardLayout,
  actions,
  getDetailHref,
  detailHrefBase,
  detailHrefField = 'id',
  rowActions = [],
}: ManagementConsolePageProps) {
  const [rows, setRows] = useState<ManagementConsoleRecord[]>(initialRows);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(initialRows[0]?.id ?? null);
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [formState, setFormState] = useState<ManagementConsoleRecord>(() =>
    buildFormState(fields, statusOptions, initialRows[0]),
  );
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = statusFilter === '全部' || row.status === statusFilter;
      const searchableText = Object.values(row).join(' ').toLowerCase();
      return matchesStatus && (!normalizedQuery || searchableText.includes(normalizedQuery));
    });
  }, [query, rows, statusFilter]);

  const activeRow = rows.find((row) => row.id === activeId) ?? visibleRows[0] ?? null;
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row.id));
  const statusSummary = statusOptions.map((status) => ({
    status,
    count: rows.filter((row) => row.status === status).length,
  }));
  const columnLabelByKey = new Map(columns.map((column) => [column.key, column.label]));
  const cardTitleKey = cardLayout?.titleKey ?? columns[0]?.key ?? 'id';
  const cardSubtitleKey = cardLayout?.subtitleKey ?? columns[1]?.key;
  const cardMetaKeys = cardLayout?.metaKeys ?? columns.slice(1, 4).map((column) => column.key);
  const cardDescriptionKeys = cardLayout?.descriptionKeys ?? columns.slice(4, 7).map((column) => column.key);

  const openDialog = (mode: DialogMode, row?: ManagementConsoleRecord) => {
    setDialogMode(mode);
    setFormState(buildFormState(fields, statusOptions, row));
  };

  const closeDialog = () => {
    setDialogMode(null);
    setFormState(buildFormState(fields, statusOptions));
  };

  const postAction = async (path: string, payload: Record<string, unknown>) => {
    if (!actions) return;
    const response = await fetch(getGatewayApiUrl(actions.service, path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) {
      throw new Error(result.message ?? '操作失败');
    }
  };

  const postExternalAction = async (rowAction: ManagementConsoleRowAction, row: ManagementConsoleRecord) => {
    const response = await fetch(getGatewayApiUrl(rowAction.service, rowAction.path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [rowAction.idParam]: row[rowAction.idField ?? 'id'] ?? row.id }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) {
      throw new Error(result.message ?? '操作失败');
    }
    return result;
  };

  const persistUpsert = async (rowId: string) => {
    if (!actions) return;
    const data = mapActionFields(formState, actions.fieldMap, actions.statusValueByLabel);
    if (dialogMode === 'create' && actions.createPath) {
      await postAction(actions.createPath, data);
      return;
    }
    if (dialogMode === 'edit' && actions.updatePath) {
      await postAction(actions.updatePath, {
        [actions.idParam]: rowId,
        [actions.updateDataParam ?? 'data']: data,
      });
    }
  };

  const upsertRow = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const rowId =
      dialogMode === 'edit'
        ? formState.id
        : actions
          ? String(formState[actions.idField ?? 'id'] || `local-${Date.now()}`)
          : `local-${Date.now()}`;
    const nextRow = { ...formState, id: rowId };

    try {
      await persistUpsert(rowId);
      setActionMessage(dialogMode === 'create' ? '创建成功' : '更新成功');
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : '操作失败');
      return;
    }

    setRows((currentRows) =>
      dialogMode === 'edit' ? currentRows.map((row) => (row.id === rowId ? nextRow : row)) : [nextRow, ...currentRows],
    );
    setActiveId(rowId);
    closeDialog();
  };

  const deleteRow = async (rowId: string) => {
    try {
      if (actions?.deletePath) {
        await postAction(actions.deletePath, { [actions.idParam]: rowId });
      }
      setActionMessage('删除成功');
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : '删除失败');
      return;
    }

    setRows((currentRows) => currentRows.filter((row) => row.id !== rowId));
    setSelectedIds((currentIds) => currentIds.filter((id) => id !== rowId));
    setActiveId((currentId) => {
      if (currentId !== rowId) return currentId;
      return rows.find((row) => row.id !== rowId)?.id ?? null;
    });
    setPendingDeleteId(null);
  };

  const toggleStatus = async (row: ManagementConsoleRecord) => {
    const currentIndex = statusOptions.indexOf(row.status);
    const nextStatus = statusOptions[(currentIndex + 1) % statusOptions.length] ?? row.status;
    try {
      if (actions?.statusPath) {
        await postAction(actions.statusPath, {
          [actions.idParam]: row.id,
          [actions.statusParam ?? 'status']: actions.statusValueByLabel?.[nextStatus] ?? nextStatus,
        });
      }
      setActionMessage('状态已更新');
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : '状态更新失败');
      return;
    }
    setRows((currentRows) =>
      currentRows.map((currentRow) => (currentRow.id === row.id ? { ...currentRow, status: nextStatus } : currentRow)),
    );
  };

  const runRowAction = async (rowAction: ManagementConsoleRowAction, row: ManagementConsoleRecord) => {
    try {
      const result = await postExternalAction(rowAction, row);
      const message =
        typeof result.message === 'string'
          ? result.message
          : typeof result.data?.message === 'string'
            ? result.data.message
            : rowAction.successMessage;
      setActionMessage(message);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : '操作失败');
    }
  };

  const toggleAllVisibleRows = () => {
    setSelectedIds((currentIds) => {
      if (allVisibleSelected) return currentIds.filter((id) => !visibleRows.some((row) => row.id === id));
      return Array.from(new Set([...currentIds, ...visibleRows.map((row) => row.id)]));
    });
  };

  const toggleSelectedRow = (rowId: string) => {
    setSelectedIds((currentIds) =>
      currentIds.includes(rowId) ? currentIds.filter((id) => id !== rowId) : [...currentIds, rowId],
    );
  };

  const isSaveDisabled = fields.some((field) => field.required && !String(formState[field.key] ?? '').trim());
  const resolveDetailHref = (row: ManagementConsoleRecord) =>
    getDetailHref?.(row) ?? (detailHrefBase ? `${detailHrefBase}/${String(row[detailHrefField] ?? row.id)}` : '');

  return (
    <section className="console-page" aria-label={title}>
      <header className="console-heading">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <button className="console-button console-button-primary" type="button" onClick={() => openDialog('create')}>
          {createLabel}
        </button>
      </header>
      {actionMessage ? <div className="console-message">{actionMessage}</div> : null}

      <div className="console-metrics" aria-label="状态概览">
        <div className="console-metric">
          <span>全部</span>
          <strong>{rows.length}</strong>
        </div>
        {statusSummary.map((item) => (
          <div className="console-metric" key={item.status}>
            <span>{item.status}</span>
            <strong>{item.count}</strong>
          </div>
        ))}
      </div>

      <div className="console-surface">
        <div className="console-toolbar">
          <TextInput
            aria-label="搜索"
            className="console-search"
            value={query}
            placeholder={searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="console-status-filter" aria-label="状态筛选">
            {['全部', ...statusOptions].map((status) => (
              <button
                className={statusFilter === status ? 'is-active' : ''}
                type="button"
                key={status}
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="console-selection-bar">
          <span>
            {viewMode === 'cards'
              ? `共 ${visibleRows.length} 项`
              : selectedIds.length > 0
                ? `已选择 ${selectedIds.length} 项`
                : `共 ${visibleRows.length} 项`}
          </span>
          {viewMode === 'table' && selectedIds.length > 0 ? (
            <button className="console-button" type="button" onClick={() => setSelectedIds([])}>
              清除选择
            </button>
          ) : null}
        </div>

        {viewMode === 'cards' ? (
          <div className="console-card-grid" aria-label={`${title}卡片列表`}>
            {visibleRows.map((row) => (
              <article
                className={activeRow?.id === row.id ? 'console-record-card is-selected' : 'console-record-card'}
                key={row.id}
                onClick={() => setActiveId(row.id)}
              >
                <div className="console-record-card-top">
                  <span className="console-record-avatar">{String(row[cardTitleKey] ?? row.id).slice(0, 1)}</span>
                  <span className={`console-status-pill console-status-${row.status}`}>{row.status}</span>
                </div>
                <div className="console-record-card-title">
                  <h2>{String(row[cardTitleKey] ?? row.id)}</h2>
                  {cardSubtitleKey ? <p>{String(row[cardSubtitleKey] ?? '')}</p> : null}
                </div>
                <div className="console-record-meta">
                  {cardMetaKeys.map((key) => (
                    <span key={key}>{String(row[key] ?? '')}</span>
                  ))}
                </div>
                <dl className="console-record-facts">
                  {cardDescriptionKeys.map((key) => (
                    <div key={key}>
                      <dt>{columnLabelByKey.get(key) ?? key}</dt>
                      <dd>{String(row[key] ?? '')}</dd>
                    </div>
                  ))}
                </dl>
                <div className="console-record-actions" onClick={(event) => event.stopPropagation()}>
                  {getDetailHref || detailHrefBase ? (
                    <Link className="console-record-primary-link" href={resolveDetailHref(row)}>
                      {cardLayout?.primaryActionLabel ?? '进入'}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => setActiveId(row.id)}>
                      详情
                    </button>
                  )}
                  <button type="button" onClick={() => openDialog('edit', row)}>
                    编辑
                  </button>
                  <button type="button" onClick={() => toggleStatus(row)}>
                    {row.status === statusOptions[0] ? statusOptions[1] : statusOptions[0]}
                  </button>
                  {rowActions.map((rowAction) => (
                    <button key={rowAction.label} type="button" onClick={() => runRowAction(rowAction, row)}>
                      {rowAction.label}
                    </button>
                  ))}
                  <button className="is-danger" type="button" onClick={() => setPendingDeleteId(row.id)}>
                    删除
                  </button>
                </div>
              </article>
            ))}
            {visibleRows.length === 0 ? <div className="console-card-empty">暂无匹配数据</div> : null}
          </div>
        ) : (
          <div className="console-table-wrap">
            <table className="console-table">
              <thead>
                <tr>
                  <th className="console-check-cell">
                    <input
                      aria-label="选择全部可见行"
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisibleRows}
                    />
                  </th>
                  {columns.map((column) => (
                    <th key={column.key} style={column.width ? { width: column.width } : undefined}>
                      {column.label}
                    </th>
                  ))}
                  <th className="console-action-cell">操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr className={activeRow?.id === row.id ? 'is-selected' : ''} key={row.id}>
                    <td className="console-check-cell">
                      <input
                        aria-label={`选择 ${String(row[columns[0]?.key] ?? row.id)}`}
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => toggleSelectedRow(row.id)}
                      />
                    </td>
                    {columns.map((column) => (
                      <td key={column.key} onClick={() => setActiveId(row.id)}>
                        {column.key === 'status' ? (
                          <span className={`console-status-pill console-status-${row.status}`}>{row.status}</span>
                        ) : (
                          String(row[column.key] ?? '')
                        )}
                      </td>
                    ))}
                    <td className="console-row-actions">
                      {getDetailHref || detailHrefBase ? (
                        <Link className="console-row-link" href={resolveDetailHref(row)}>
                          进入
                        </Link>
                      ) : (
                        <button type="button" onClick={() => setActiveId(row.id)}>
                          详情
                        </button>
                      )}
                      <button type="button" onClick={() => openDialog('edit', row)}>
                        编辑
                      </button>
                      <button type="button" onClick={() => toggleStatus(row)}>
                        切换状态
                      </button>
                      {rowActions.map((rowAction) => (
                        <button key={rowAction.label} type="button" onClick={() => runRowAction(rowAction, row)}>
                          {rowAction.label}
                        </button>
                      ))}
                      <button className="is-danger" type="button" onClick={() => setPendingDeleteId(row.id)}>
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
                {visibleRows.length === 0 ? (
                  <tr>
                    <td className="console-empty" colSpan={columns.length + 2}>
                      暂无匹配数据
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <aside className="console-drawer" aria-label="详情抽屉">
        <div className="console-drawer-header">
          <div>
            <span>详情</span>
            <strong>{String(activeRow?.[columns[0]?.key] ?? '未选择')}</strong>
          </div>
          {activeRow ? (
            <button className="console-button" type="button" onClick={() => openDialog('edit', activeRow)}>
              编辑
            </button>
          ) : null}
        </div>
        {activeRow ? (
          <dl className="console-detail-list">
            {columns.map((column) => (
              <div key={column.key}>
                <dt>{column.label}</dt>
                <dd>
                  {column.key === 'status' ? (
                    <span className={`console-status-pill console-status-${activeRow.status}`}>{activeRow.status}</span>
                  ) : (
                    String(activeRow[column.key] ?? '')
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="console-empty-text">选择一行查看详情</p>
        )}
      </aside>

      <DialogRoot open={Boolean(dialogMode)} onOpenChange={(open) => !open && closeDialog()}>
        {dialogMode ? (
          <DialogContent
            description={String(formState[columns[0]?.key] || title)}
            title={dialogMode === 'create' ? '创建记录' : '编辑记录'}
          >
          <form className="console-dialog-form" aria-label={dialogMode === 'create' ? '创建表单' : '编辑表单'} onSubmit={upsertRow}>
            <div className="console-form-grid">
              {fields.map((field) => (
                <div className={field.type === 'textarea' ? 'console-form-field is-wide' : 'console-form-field'} key={field.key}>
                  <span>{field.label}</span>
                  {field.type === 'textarea' ? (
                    <TextArea
                      aria-label={field.label}
                      value={String(formState[field.key] ?? '')}
                      placeholder={field.placeholder}
                      required={field.required}
                      onChange={(event) => setFormState((current) => ({ ...current, [field.key]: event.target.value }))}
                    />
                  ) : field.type === 'select' ? (
                    <ConsoleSelect
                      value={String(formState[field.key] ?? field.options?.[0] ?? '')}
                      onValueChange={(value) => setFormState((current) => ({ ...current, [field.key]: value }))}
                      options={(field.options ?? []).map((option) => ({ label: option, value: option }))}
                    />
                  ) : (
                    <TextInput
                      aria-label={field.label}
                      value={String(formState[field.key] ?? '')}
                      placeholder={field.placeholder}
                      required={field.required}
                      onChange={(event) => setFormState((current) => ({ ...current, [field.key]: event.target.value }))}
                    />
                  )}
                </div>
              ))}
              <label className="console-form-field">
                <span>状态</span>
                <ConsoleSelect
                  value={formState.status}
                  onValueChange={(value) => setFormState((current) => ({ ...current, status: value }))}
                  options={statusOptions.map((status) => ({ label: status, value: status }))}
                />
              </label>
            </div>
            <div className="console-modal-actions">
              <button className="console-button" type="button" onClick={closeDialog}>
                取消
              </button>
              <button className="console-button console-button-primary" type="submit" disabled={isSaveDisabled}>
                保存
              </button>
            </div>
          </form>
          </DialogContent>
        ) : null}
      </DialogRoot>

      <DialogRoot open={Boolean(pendingDeleteId)} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        {pendingDeleteId ? (
          <DialogContent
            className="console-confirm"
            description="删除后会立即从当前本地列表中移除。"
            showClose={false}
            title="删除确认"
          >
            <div className="console-modal-actions">
              <button className="console-button" type="button" onClick={() => setPendingDeleteId(null)}>
                取消
              </button>
              <button className="console-button console-button-danger" type="button" onClick={() => deleteRow(pendingDeleteId)}>
                确认删除
              </button>
            </div>
          </DialogContent>
        ) : null}
      </DialogRoot>
    </section>
  );
}
