'use client';

import { FormEvent, useMemo, useState } from 'react';
import { getGatewayApiUrl } from '@ai-quality-platform/shared-config';
import { ArrowRight, Check, Pencil, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { AppView } from './app-data';
import { ConsoleSelect, DialogContent, DialogRoot, PopoverConfirm, TextInput } from '@/components/ui';

type DialogMode = 'create' | 'edit';

interface AppCatalogPageProps {
  initialApps: AppView[];
}

interface AppFormState {
  code: string;
  name: string;
  type: string;
  domain: string;
  owner: string;
  endpoint: string;
  method: string;
  authType: string;
  headerTemplate: string;
  bodyTemplate: string;
  requestSchema: string;
  responseSchema: string;
  answerPath: string;
  successExpression: string;
  streamEnabled: boolean;
}

interface GatewayResponse {
  success?: boolean;
  message?: string;
  data?: {
    message?: string;
  };
}

type FieldErrors<T> = Partial<Record<keyof T, string>>;

const APP_TYPES = ['CHATBOT', 'WORKFLOW', 'RAG', 'AGENT'];
const TYPE_LABELS: Record<string, string> = {
  CHATBOT: '对话应用',
  WORKFLOW: '工作流应用',
  RAG: '知识库问答',
  AGENT: '智能体应用',
};

function getTypeLabel(type: string) {
  return TYPE_LABELS[type] ?? type;
}

function emptyForm(): AppFormState {
  return {
    code: '',
    name: '',
    type: 'CHATBOT',
    domain: '',
    owner: '',
    endpoint: '',
    method: 'POST',
    authType: 'NONE',
    headerTemplate: '{\n  "Content-Type": "application/json"\n}',
    bodyTemplate: '{\n  "query": "{{case.input.query}}"\n}',
    requestSchema: '{\n  "query": "string"\n}',
    responseSchema: '{\n  "data": {\n    "content": "string"\n  }\n}',
    answerPath: '$.data.content',
    successExpression: '$.code == 0',
    streamEnabled: false,
  };
}

function formFromApp(app: AppView): AppFormState {
  const endpoint = String(app.endpoint ?? app.protocol.url);
  return {
    code: app.code,
    name: app.name,
    type: app.type,
    domain: app.domain,
    owner: app.owner,
    endpoint: endpoint === '未配置' ? '' : endpoint,
    method: app.protocol.method,
    authType: app.protocol.authType,
    headerTemplate: app.protocol.headerTemplate,
    bodyTemplate: app.protocol.bodyTemplate,
    requestSchema: app.protocol.requestSchema,
    responseSchema: app.protocol.responseSchema,
    answerPath: app.protocol.answerPath,
    successExpression: app.protocol.successExpression,
    streamEnabled: app.protocol.streamEnabled,
  };
}

function appFromForm(form: AppFormState, status: AppView['status'] = '启用'): AppView {
  const endpoint = form.endpoint.trim();
  const protocolReady = endpoint ? '已配置' : '待配置';

  return {
    id: form.code,
    code: form.code,
    name: form.name,
    type: form.type,
    domain: form.domain,
    owner: form.owner || '未分配',
    endpoint: endpoint || '未配置',
    method: form.method,
    authType: form.authType,
    headerTemplate: form.headerTemplate,
    bodyTemplate: form.bodyTemplate,
    requestSchema: form.requestSchema,
    responseSchema: form.responseSchema,
    answerPath: form.answerPath,
    successExpression: form.successExpression,
    protocolReady,
    status,
    protocol: {
      method: form.method,
      url: endpoint,
      authType: form.authType,
      headerTemplate: form.headerTemplate,
      bodyTemplate: form.bodyTemplate,
      requestSchema: form.requestSchema,
      responseSchema: form.responseSchema,
      answerPath: form.answerPath,
      successExpression: form.successExpression,
      streamEnabled: form.streamEnabled,
    },
  };
}

function toPayload(form: AppFormState) {
  return {
    appCode: form.code.trim(),
    appName: form.name.trim(),
    appType: form.type,
    businessDomain: form.domain.trim(),
    owner: form.owner.trim(),
    invokeUrl: form.endpoint.trim(),
    requestMethod: form.method,
    authType: form.authType,
    headerTemplate: form.headerTemplate,
    bodyTemplate: form.bodyTemplate,
    requestSchema: form.requestSchema,
    responseSchema: form.responseSchema,
    answerPath: form.answerPath.trim(),
    successExpression: form.successExpression.trim(),
    streamEnabled: form.streamEnabled,
  };
}

async function postBusiness(path: string, payload: Record<string, unknown>) {
  const response = await fetch(getGatewayApiUrl('business', path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => ({}))) as GatewayResponse;
  if (!response.ok || result.success === false) {
    throw new Error(result.message ?? result.data?.message ?? '操作失败');
  }
  return result;
}

/**
 * @author codex
 * Presents AI applications as workspace cards instead of a table-first management surface.
 */
export function AppCatalogPage({ initialApps }: AppCatalogPageProps) {
  const [apps, setApps] = useState(initialApps);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('全部');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [formState, setFormState] = useState<AppFormState>(() => emptyForm());
  const [formErrors, setFormErrors] = useState<FieldErrors<AppFormState>>({});
  const [pendingDelete, setPendingDelete] = useState<AppView | null>(null);
  const [actionMessage, setActionMessage] = useState('');

  const notify = (message: string) => {
    setActionMessage(message);
    toast(message);
  };

  const visibleApps = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return apps.filter((app) => {
      const searchable = [app.code, app.name, app.type, app.domain, app.owner, app.endpoint].join(' ').toLowerCase();
      return (
        (!normalizedQuery || searchable.includes(normalizedQuery)) &&
        (typeFilter === '全部' || app.type === typeFilter) &&
        (statusFilter === '全部' || app.status === statusFilter)
      );
    });
  }, [apps, query, statusFilter, typeFilter]);

  const liveTypeOptions = Array.from(new Set([...APP_TYPES, ...apps.map((app) => app.type)]));

  const openDialog = (mode: DialogMode, app?: AppView) => {
    setDialogMode(mode);
    setFormErrors({});
    setFormState(mode === 'edit' && app ? formFromApp(app) : emptyForm());
  };

  const closeDialog = () => {
    setDialogMode(null);
    setFormErrors({});
    setFormState(emptyForm());
  };

  const validateForm = () => {
    const errors: FieldErrors<AppFormState> = {};
    if (!formState.code.trim()) errors.code = '请填写应用编码。';
    if (!formState.name.trim()) errors.name = '请填写应用名称。';
    if (!formState.type.trim()) errors.type = '请选择应用类型。';
    if (!formState.domain.trim()) errors.domain = '请填写业务领域。';
    if (!formState.owner.trim()) errors.owner = '请填写负责人。';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveApp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) return;
    const payload = toPayload(formState);
    try {
      if (dialogMode === 'edit') {
        await postBusiness('/app/update.do', {
          appCode: formState.code,
          data: {
            appName: payload.appName,
            appType: payload.appType,
            businessDomain: payload.businessDomain,
            owner: payload.owner,
          },
        });
      } else {
        await postBusiness('/app/create.do', payload);
      }
      const currentStatus = apps.find((app) => app.code === payload.appCode)?.status ?? '启用';
      const nextApp = appFromForm({ ...formState, code: payload.appCode, name: payload.appName }, currentStatus);
      setApps((current) =>
        dialogMode === 'edit'
          ? current.map((app) => (app.code === nextApp.code ? nextApp : app))
          : [nextApp, ...current],
      );
      notify(dialogMode === 'edit' ? '应用配置已更新' : 'AI 应用已创建');
      closeDialog();
    } catch (error) {
      notify(error instanceof Error ? error.message : '应用保存失败');
    }
  };

  const toggleStatus = async (app: AppView) => {
    const nextStatus = app.status === '启用' ? 'DISABLED' : 'ENABLED';
    try {
      await postBusiness('/app/change-status.do', { appCode: app.code, status: nextStatus });
      setApps((current) =>
        current.map((item) => (item.code === app.code ? { ...item, status: nextStatus === 'ENABLED' ? '启用' : '停用' } : item)),
      );
      notify(nextStatus === 'ENABLED' ? '应用已启用' : '应用已停用');
    } catch (error) {
      notify(error instanceof Error ? error.message : '应用状态更新失败');
    }
  };

  const deleteApp = async () => {
    if (!pendingDelete) return;
    try {
      await postBusiness('/app/delete.do', { appCode: pendingDelete.code });
      setApps((current) => current.filter((app) => app.code !== pendingDelete.code));
      setPendingDelete(null);
      notify('应用已删除');
    } catch (error) {
      notify(error instanceof Error ? error.message : '应用删除失败');
    }
  };

  return (
    <section className="app-catalog-page" aria-label="AI 应用">
      <header className="console-heading">
        <div>
          <h1>AI 应用</h1>
          <p>管理被测 AI 应用的入口、负责人和协议配置，保持接入状态可扫描。</p>
        </div>
        <span className="console-soft-badge">{apps.filter((app) => app.status === '启用').length} 个启用</span>
      </header>

      {actionMessage ? (
        <div className="console-message" role="status">
          {actionMessage}
        </div>
      ) : null}

      <div className="app-catalog-controls">
        <TextInput
          aria-label="搜索应用"
          className="app-catalog-search"
          prefix={<Search size={15} strokeWidth={1.9} aria-hidden="true" />}
          value={query}
          placeholder="搜索应用名称、编码、领域、负责人或接口"
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="app-catalog-filter-group">
          <ConsoleSelect
            ariaLabel="按应用类型筛选"
            value={typeFilter}
            onValueChange={setTypeFilter}
            options={[
              { label: '全部类型', value: '全部' },
              ...liveTypeOptions.map((type) => ({ label: getTypeLabel(type), value: type })),
            ]}
          />
          <ConsoleSelect
            ariaLabel="按应用状态筛选"
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={[
              { label: '全部状态', value: '全部' },
              { label: '启用', value: '启用' },
              { label: '停用', value: '停用' },
            ]}
          />
        </div>
        <div className="app-catalog-toolbar-actions">
          <button className="console-button console-button-primary" type="button" onClick={() => openDialog('create')}>
            <Plus size={14} strokeWidth={2} aria-hidden="true" />
            新增应用
          </button>
        </div>
      </div>

      <div className="app-catalog-grid" aria-label="AI 应用卡片列表">
        {visibleApps.map((app) => (
          <article className="app-catalog-card" key={app.code}>
            <button className="app-catalog-edit-icon" type="button" aria-label={`编辑 ${app.name}`} onClick={() => openDialog('edit', app)}>
              <Pencil size={16} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <div className="app-catalog-card-title">
              <h2>{app.name}</h2>
              <p>{app.code}</p>
            </div>
            <div className="app-catalog-meta">
              <span className={`app-catalog-meta-chip app-catalog-type-chip app-catalog-type-${app.type.toLowerCase()}`}>{getTypeLabel(app.type)}</span>
              <span className="app-catalog-meta-chip app-catalog-domain-chip">{app.domain}</span>
              <span className="app-catalog-meta-chip app-catalog-owner-chip">{app.owner}</span>
              <span className={`console-status-pill console-status-${app.status}`}>{app.status}</span>
            </div>
            <dl className="app-catalog-card-facts">
              <div>
                <dt>接口</dt>
                <dd>{String(app.endpoint)}</dd>
              </div>
              <div>
                <dt>协议</dt>
                <dd>
                  {String(app.method)} · {String(app.authType)} · {String(app.protocolReady)}
                </dd>
              </div>
              <div>
                <dt>答案路径</dt>
                <dd>{app.protocol.answerPath}</dd>
              </div>
            </dl>
            <div className="app-catalog-card-actions">
              <a className="app-catalog-primary-link" href={`/ai-quality-platform/apps/${app.code}`}>
                进入应用 <ArrowRight size={13} strokeWidth={1.9} aria-hidden="true" />
              </a>
              <PopoverConfirm
                aria-label="状态变更确认"
                description={`该应用会被${app.status === '启用' ? '停用' : '启用'}，关联计划不会被删除。`}
                onConfirm={() => void toggleStatus(app)}
                title={`确认${app.status === '启用' ? '停用' : '启用'}这个应用？`}
              >
                <button type="button">
                  <ShieldCheck size={13} strokeWidth={1.9} aria-hidden="true" />
                  {app.status === '启用' ? '停用' : '启用'}
                </button>
              </PopoverConfirm>
              <button className="is-danger" type="button" onClick={() => setPendingDelete(app)}>
                <Trash2 size={13} strokeWidth={1.9} aria-hidden="true" />
                删除
              </button>
            </div>
          </article>
        ))}
        {visibleApps.length === 0 ? (
          <div className="app-catalog-empty">
            <strong>{apps.length === 0 ? '暂无 AI 应用' : '没有匹配的应用'}</strong>
            <p>{apps.length === 0 ? '从这里新建第一个被测 AI 应用，然后进入应用配置接入协议和测试用例。' : '调整筛选条件，或新建一个被测 AI 应用。'}</p>
            <button className="console-button console-button-primary" type="button" onClick={() => openDialog('create')}>
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              新增应用
            </button>
          </div>
        ) : null}
      </div>

      <DialogRoot open={Boolean(dialogMode)} onOpenChange={(open) => !open && closeDialog()}>
        {dialogMode ? (
          <DialogContent
            className="app-catalog-modal"
            description={formState.name || '维护被测应用基础信息，接口协议进入应用后继续配置。'}
            title={dialogMode === 'create' ? '新增应用' : '编辑应用'}
          >
          <form className="console-dialog-form" aria-label={dialogMode === 'create' ? '新增应用表单' : '编辑应用表单'} noValidate onSubmit={saveApp}>
            <div className="console-form-grid">
              <TextInput
                className="console-form-field"
                label="应用编码"
                value={formState.code}
                error={formErrors.code}
                disabled={dialogMode === 'edit'}
                required
                placeholder="如 credit_assistant"
                onChange={(event) => setFormState((current) => ({ ...current, code: event.target.value }))}
              />
              <TextInput
                className="console-form-field"
                label="应用名称"
                value={formState.name}
                error={formErrors.name}
                required
                placeholder="如 信用服务助手"
                onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
              />
              <ConsoleSelect
                ariaLabel="应用类型"
                className="console-form-field"
                error={formErrors.type}
                label="应用类型"
                required
                value={formState.type}
                onValueChange={(value) => setFormState((current) => ({ ...current, type: value }))}
                options={APP_TYPES.map((type) => ({ label: getTypeLabel(type), value: type }))}
              />
              <TextInput
                className="console-form-field"
                label="业务领域"
                value={formState.domain}
                error={formErrors.domain}
                required
                onChange={(event) => setFormState((current) => ({ ...current, domain: event.target.value }))}
              />
              <TextInput
                className="console-form-field"
                label="负责人"
                value={formState.owner}
                error={formErrors.owner}
                required
                onChange={(event) => setFormState((current) => ({ ...current, owner: event.target.value }))}
              />
            </div>
            <div className="console-modal-actions">
              <button className="console-button" type="button" onClick={closeDialog}>
                取消
              </button>
              <button className="console-button console-button-primary" type="submit">
                <Check size={14} strokeWidth={2} aria-hidden="true" />
                保存应用
              </button>
            </div>
          </form>
          </DialogContent>
        ) : null}
      </DialogRoot>

      <DialogRoot open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        {pendingDelete ? (
          <DialogContent
            className="app-catalog-danger-modal"
            description={`确认删除 ${pendingDelete.name}？删除后，这个应用关联的用例、计划和执行记录后续需要重新挂载。`}
            footer={
              <>
              <button className="console-button" type="button" onClick={() => setPendingDelete(null)}>
                取消
              </button>
              <button className="console-button console-button-danger" type="button" onClick={deleteApp}>
                <Trash2 size={14} strokeWidth={1.9} aria-hidden="true" />
                确认删除
              </button>
              </>
            }
            title="删除应用确认"
          />
        ) : null}
      </DialogRoot>
    </section>
  );
}
