'use client';

import { Boxes, Check, FlaskConical, Pencil, Plus, RefreshCw, Search, ServerCog, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { QButton, QConfirmDialog, QEmptyState, QModal, QSelectField, QStatusChip, QTextField } from '@/components/qtp-ui';
import { buildModelForm, buildModelPayload, buildProviderForm, formatTokenDisplay, MODEL_TYPE_META, parseTokenCount, PROVIDER_TYPE_META, PROTOCOL_META, SUPPORT_OPTIONS, providerToOptionLabel } from './model-center-schema';
import { useModelCenterData, useModelCenterMutations } from './model-center-queries';
import type { DialogMode, FieldErrors, ModelCenterRecord, ModelCenterTab, ModelFormState, ModelProviderRecord, ProviderFormState, ProviderType, StatusLabel } from './types';

interface ModelCenterPageProps {
  initialModels: ModelCenterRecord[];
  initialProviders: ModelProviderRecord[];
}

type ConfirmTarget =
  | { kind: 'model-status'; model: ModelCenterRecord }
  | { kind: 'provider-status'; provider: ModelProviderRecord }
  | null;

interface GatewayMessage {
  message?: string;
  data?: { message?: string };
}

function toNumber(value: string, fallback?: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : fallback;
}

function formatTokenInput(value?: number) {
  if (!value) return '';
  if (value % 1_000_000 === 0) return `${value / 1_000_000}m`;
  if (value % 1_000 === 0) return `${value / 1_000}k`;
  return String(value);
}

function providerToForm(provider: ModelProviderRecord): ProviderFormState {
  return {
    name: provider.name,
    type: provider.type,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
  };
}

function modelToForm(model: ModelCenterRecord): ModelFormState {
  return {
    ...buildModelForm(model.provider, model.providerType, model.modelType),
    name: model.name,
    modelId: model.modelId,
    contextWindow: formatTokenInput(model.limits.contextWindow),
    maxOutputTokens: formatTokenInput(model.parameters.maxOutputTokens ?? model.limits.maxOutputTokens),
    stream: String(model.parameters.stream ?? model.capabilities.stream ?? true),
    jsonMode: String(model.parameters.jsonMode ?? model.capabilities.jsonMode ?? false),
    toolCalling: String(model.parameters.toolCalling ?? model.capabilities.toolCalling ?? false),
    thinkingEnabled: String(model.parameters.thinkingEnabled ?? model.capabilities.reasoning ?? false),
    dimensions: String(model.parameters.dimensions ?? model.limits.embeddingDimensions ?? ''),
  };
}

function mutationMessage(result: GatewayMessage, fallback: string) {
  return result.message ?? result.data?.message ?? fallback;
}

/**
 * @author codex
 * Renders the HeroUI POC Model Center while preserving the original console workflows.
 */
export function ModelCenterPage({ initialModels, initialProviders }: ModelCenterPageProps) {
  const { data, isFetching, refetch } = useModelCenterData({ models: initialModels, providers: initialProviders });
  const mutations = useModelCenterMutations();
  const [models, setModels] = useState(initialModels);
  const [providers, setProviders] = useState(initialProviders);
  const [activeTab, setActiveTab] = useState<ModelCenterTab>('models');
  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('全部');
  const [modelTypeFilter, setModelTypeFilter] = useState<'全部' | ModelFormState['modelType']>('全部');
  const [statusFilter, setStatusFilter] = useState<'全部' | StatusLabel>('全部');
  const [modelDialogMode, setModelDialogMode] = useState<DialogMode | null>(null);
  const [modelForm, setModelForm] = useState<ModelFormState>(() => buildModelForm(initialProviders[0]?.code ?? '', initialProviders[0]?.type));
  const [modelErrors, setModelErrors] = useState<FieldErrors<ModelFormState>>({});
  const [editingModelId, setEditingModelId] = useState('');
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [providerFormMode, setProviderFormMode] = useState<DialogMode>('create');
  const [providerForm, setProviderForm] = useState<ProviderFormState>(() => buildProviderForm());
  const [providerErrors, setProviderErrors] = useState<FieldErrors<ProviderFormState>>({});
  const [editingProviderCode, setEditingProviderCode] = useState('');
  const [pendingModelDelete, setPendingModelDelete] = useState<ModelCenterRecord | null>(null);
  const [pendingProviderDelete, setPendingProviderDelete] = useState<ModelProviderRecord | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<ConfirmTarget>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [modelTesting, setModelTesting] = useState(false);
  const [providerTesting, setProviderTesting] = useState(false);

  useEffect(() => {
    setModels(data.models);
    setProviders(data.providers);
  }, [data.models, data.providers]);

  const notify = (message: string) => {
    setActionMessage(message);
    toast(message);
  };

  const refreshModelCenter = async () => {
    const result = await refetch();
    if (result.error) {
      notify(result.error instanceof Error ? result.error.message : '模型中心刷新失败');
      return;
    }
    notify('模型中心已刷新');
  };

  const providersByCode = useMemo(() => new Map(providers.map((provider) => [provider.code, provider])), [providers]);
  const enabledProviderOptions = useMemo(() => providers.filter((provider) => provider.status === '启用'), [providers]);
  const selectedModelProvider = providersByCode.get(modelForm.provider);
  const providerMeta = PROVIDER_TYPE_META[providerForm.type];

  const visibleModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return models.filter((model) => {
      const provider = providersByCode.get(model.provider);
      const searchable = [model.name, model.modelId, model.modelType, model.protocol, model.providerName, provider?.name, provider?.type].join(' ').toLowerCase();
      return (
        (!normalizedQuery || searchable.includes(normalizedQuery)) &&
        (providerFilter === '全部' || model.provider === providerFilter) &&
        (modelTypeFilter === '全部' || model.modelType === modelTypeFilter) &&
        (statusFilter === '全部' || model.status === statusFilter)
      );
    });
  }, [modelTypeFilter, models, providerFilter, providersByCode, query, statusFilter]);

  const updateModelField = <K extends keyof ModelFormState>(key: K, value: ModelFormState[K]) => {
    setModelForm((current) => {
      if (key === 'provider') {
        const provider = providersByCode.get(String(value));
        return { ...buildModelForm(String(value), provider?.type, current.modelType), name: current.name };
      }
      if (key === 'modelType') {
        return { ...buildModelForm(current.provider, selectedModelProvider?.type, value as ModelFormState['modelType']), name: current.name };
      }
      return { ...current, [key]: value };
    });
    setModelErrors((current) => ({ ...current, [key]: undefined }));
  };

  const updateProviderField = <K extends keyof ProviderFormState>(key: K, value: ProviderFormState[K]) => {
    setProviderForm((current) => ({ ...current, [key]: value }));
    setProviderErrors((current) => ({ ...current, [key]: undefined }));
  };

  const openProviderPanel = (mode: DialogMode, provider?: ModelProviderRecord) => {
    setActiveTab('providers');
    setProviderDialogOpen(true);
    setProviderErrors({});
    setProviderFormMode(mode);
    setEditingProviderCode(mode === 'edit' && provider ? provider.code : '');
    setProviderForm(mode === 'edit' && provider ? providerToForm(provider) : buildProviderForm());
  };

  const openModelDialog = (mode: DialogMode, model?: ModelCenterRecord) => {
    if (mode === 'create' && enabledProviderOptions.length === 0) {
      notify('请先添加或启用至少一个供应商，再添加模型');
      openProviderPanel('create');
      return;
    }
    setModelErrors({});
    setModelDialogMode(mode);
    setEditingModelId(mode === 'edit' && model ? model.id : '');
    setModelForm(mode === 'edit' && model ? modelToForm(model) : buildModelForm(enabledProviderOptions[0]?.code ?? '', enabledProviderOptions[0]?.type));
  };

  const closeModelDialog = () => {
    setModelDialogMode(null);
    setModelErrors({});
    setEditingModelId('');
    setModelForm(buildModelForm(enabledProviderOptions[0]?.code ?? '', enabledProviderOptions[0]?.type));
  };

  const updateProviderType = (nextType: ProviderType) => {
    setProviderForm((current) => ({
      ...current,
      type: nextType,
      baseUrl: current.baseUrl || PROVIDER_TYPE_META[nextType].defaultBaseUrl,
    }));
    setProviderErrors((current) => ({ ...current, type: undefined }));
  };

  const validateProviderForm = () => {
    const errors: FieldErrors<ProviderFormState> = {};
    if (!providerForm.name.trim()) errors.name = '请填写供应商名称。';
    if (!providerForm.baseUrl.trim()) errors.baseUrl = '请填写接口地址。';
    if (!providerForm.apiKey.trim()) errors.apiKey = '请填写 API Key。';
    setProviderErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateModelForm = () => {
    const errors: FieldErrors<ModelFormState> = {};
    const provider = providersByCode.get(modelForm.provider);
    if (!modelForm.name.trim()) errors.name = '请填写模型名称。';
    if (!modelForm.provider || !provider) errors.provider = '请选择供应商。';
    if (!modelForm.modelId.trim()) errors.modelId = '请填写供应商模型 ID。';
    if (provider?.type === 'DEEPSEEK' && modelForm.modelType === 'EMBEDDING') errors.modelType = 'DeepSeek 官方供应商暂不支持 Embedding。';
    if (modelForm.modelType === 'LLM') {
      if (!parseTokenCount(modelForm.contextWindow)) errors.contextWindow = '请输入有效 token 数量，例如 128k 或 1000000。';
      if (!parseTokenCount(modelForm.maxOutputTokens)) errors.maxOutputTokens = '请输入有效 token 数量，例如 4k 或 4096。';
    }
    if (modelForm.modelType === 'EMBEDDING' && modelForm.dimensions && !toNumber(modelForm.dimensions)) {
      errors.dimensions = '维度必须是数字。';
    }
    setModelErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveProvider = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateProviderForm()) return;
    try {
      await mutations.saveProvider.mutateAsync({
        form: providerForm,
        editingProviderCode: providerFormMode === 'edit' ? editingProviderCode : undefined,
      });
      notify(providerFormMode === 'edit' ? '供应商已更新' : '供应商已添加');
      setProviderDialogOpen(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : '供应商保存失败');
    }
  };

  const saveModel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateModelForm()) return;
    const provider = providersByCode.get(modelForm.provider);
    if (!provider || provider.status !== '启用') {
      notify('请选择启用状态的供应商');
      return;
    }
    try {
      await mutations.saveModel.mutateAsync({
        form: modelForm,
        provider,
        editingModelId: modelDialogMode === 'edit' ? editingModelId : undefined,
      });
      notify(modelDialogMode === 'edit' ? '模型已更新' : '模型已添加');
      closeModelDialog();
    } catch (error) {
      notify(error instanceof Error ? error.message : '模型保存失败');
    }
  };

  const testProviderForm = async () => {
    if (!validateProviderForm()) return;
    setProviderTesting(true);
    try {
      const result = (await mutations.testProviderForm.mutateAsync(providerForm)) as GatewayMessage;
      notify(mutationMessage(result, '供应商测试完成'));
    } catch (error) {
      notify(error instanceof Error ? error.message : '供应商测试失败');
    } finally {
      setProviderTesting(false);
    }
  };

  const testModelForm = async () => {
    if (!validateModelForm()) return;
    const provider = providersByCode.get(modelForm.provider);
    if (!provider || provider.status !== '启用') {
      notify('请选择启用状态的供应商');
      return;
    }
    setModelTesting(true);
    try {
      const result = (await mutations.testModelForm.mutateAsync({ form: modelForm, provider })) as GatewayMessage;
      notify(mutationMessage(result, '模型测试完成'));
    } catch (error) {
      notify(error instanceof Error ? error.message : '模型测试失败');
    } finally {
      setModelTesting(false);
    }
  };

  const testModel = async (model: ModelCenterRecord) => {
    try {
      const result = (await mutations.testModel.mutateAsync(model)) as GatewayMessage;
      notify(mutationMessage(result, '模型测试完成'));
    } catch (error) {
      notify(error instanceof Error ? error.message : '模型测试失败');
    }
  };

  const testProvider = async (provider: ModelProviderRecord) => {
    try {
      const result = (await mutations.testProvider.mutateAsync(provider)) as GatewayMessage;
      notify(mutationMessage(result, '供应商测试完成'));
    } catch (error) {
      notify(error instanceof Error ? error.message : '供应商测试失败');
    }
  };

  const toggleModelStatus = async (model: ModelCenterRecord) => {
    try {
      const nextStatus = await mutations.changeModelStatus.mutateAsync(model);
      setModels((current) => current.map((item) => (item.id === model.id ? { ...item, status: nextStatus } : item)));
      notify(nextStatus === '启用' ? '模型已启用' : '模型已停用');
      setPendingConfirm(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : '状态更新失败');
    }
  };

  const toggleProviderStatus = async (provider: ModelProviderRecord) => {
    try {
      const nextStatus = await mutations.changeProviderStatus.mutateAsync(provider);
      setProviders((current) => current.map((item) => (item.code === provider.code ? { ...item, status: nextStatus } : item)));
      notify(nextStatus === '启用' ? '供应商已启用' : '供应商已停用');
      setPendingConfirm(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : '状态更新失败');
    }
  };

  const deleteModel = async () => {
    if (!pendingModelDelete) return;
    try {
      await mutations.deleteModel.mutateAsync(pendingModelDelete);
      setModels((current) => current.filter((model) => model.id !== pendingModelDelete.id));
      notify('模型已删除');
      setPendingModelDelete(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : '模型删除失败');
    }
  };

  const deleteProvider = async () => {
    if (!pendingProviderDelete) return;
    try {
      await mutations.deleteProvider.mutateAsync(pendingProviderDelete);
      setProviders((current) => current.filter((provider) => provider.code !== pendingProviderDelete.code));
      notify('供应商已删除');
      setPendingProviderDelete(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : '供应商删除失败');
    }
  };

  const modelTypeOptions = (Object.keys(MODEL_TYPE_META) as ModelFormState['modelType'][]).map((type) => ({
    label: MODEL_TYPE_META[type].label,
    value: type,
  }));
  const providerTypeOptions = (Object.keys(PROVIDER_TYPE_META) as ProviderType[]).map((type) => ({
    label: PROVIDER_TYPE_META[type].label,
    value: type,
  }));

  return (
    <section className="model-center-page">
      <header className="app-catalog-hero model-center-heading">
        <div>
          <h1>模型中心</h1>
          <p>以模型资产为主维护 LLM 与 Embedding 能力；供应商仅作为可复用的全局凭证与端点配置。</p>
        </div>
        <div className="app-catalog-page-actions">
          <button className="console-button" type="button" disabled={isFetching} onClick={() => void refreshModelCenter()}>
            <RefreshCw size={14} strokeWidth={1.9} aria-hidden="true" />
            {isFetching ? '刷新中' : '刷新'}
          </button>
          <button
            className="console-button console-button-primary app-catalog-new-button"
            type="button"
            onClick={() => (activeTab === 'providers' ? openProviderPanel('create') : openModelDialog('create'))}
          >
            <Plus size={14} strokeWidth={2} aria-hidden="true" />
            {activeTab === 'providers' ? '添加供应商' : '添加模型'}
          </button>
        </div>
      </header>

      <div className="app-catalog-summary model-center-summary" aria-label="模型中心统计">
        <span>模型 {models.length}</span>
        <span>启用模型 {models.filter((model) => model.status === '启用').length}</span>
        <span>供应商 {providers.length}</span>
        <span>启用供应商 {providers.filter((provider) => provider.status === '启用').length}</span>
      </div>
      {actionMessage ? (
        <div className="console-message" role="status">
          {actionMessage}
        </div>
      ) : null}

      <div className="preset-admin-tabs model-center-tabs" role="tablist" aria-label="模型中心管理">
        <button
          aria-selected={activeTab === 'models'}
          className={activeTab === 'models' ? 'is-active' : ''}
          role="tab"
          type="button"
          onClick={() => setActiveTab('models')}
        >
          <Boxes size={14} strokeWidth={1.9} aria-hidden="true" />
          模型列表
          <span>{models.length}</span>
        </button>
        <button
          aria-selected={activeTab === 'providers'}
          className={activeTab === 'providers' ? 'is-active' : ''}
          role="tab"
          type="button"
          onClick={() => setActiveTab('providers')}
        >
          <ServerCog size={14} strokeWidth={1.9} aria-hidden="true" />
          供应商列表
          <span>{providers.length}</span>
        </button>
      </div>

      {activeTab === 'models' ? (
        <section className="model-center-grid" role="tabpanel" aria-label="模型列表">
              <div className="model-center-toolbar">
                <div className="console-search">
                  <Search size={15} strokeWidth={1.9} aria-hidden="true" />
                  <QTextField
                    aria-label="搜索模型"
                    placeholder="搜索模型名称、模型 ID、供应商或协议"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <div className="model-filter-group" aria-label="模型筛选">
                  <QSelectField label="按模型能力筛选" selectedKey={modelTypeFilter} onSelectionChange={(key) => setModelTypeFilter(key as '全部' | ModelFormState['modelType'])} options={[{ label: '全部能力', value: '全部' }, ...modelTypeOptions]} />
                  <QSelectField label="按供应商筛选" selectedKey={providerFilter} onSelectionChange={(key) => setProviderFilter(String(key))} options={[{ label: '全部供应商', value: '全部' }, ...providers.map((provider) => ({ label: provider.name, value: provider.code }))]} />
                  <QSelectField label="按状态筛选" selectedKey={statusFilter} onSelectionChange={(key) => setStatusFilter(key as '全部' | StatusLabel)} options={[{ label: '全部状态', value: '全部' }, { label: '启用', value: '启用' }, { label: '停用', value: '停用' }]} />
                </div>
              </div>

              <div className="model-rich-list" role="list" aria-label="模型列表">
                {visibleModels.map((model) => {
                  const provider = providersByCode.get(model.provider);
                  const limitText =
                    model.modelType === 'EMBEDDING'
                      ? `${model.limits.embeddingDimensions ?? model.parameters.dimensions ?? '-'} 维`
                      : `${formatTokenDisplay(model.limits.contextWindow)} ctx / ${formatTokenDisplay(model.limits.maxOutputTokens ?? model.parameters.maxOutputTokens)} out`;
                  const capabilityText =
                    model.modelType === 'EMBEDDING'
                      ? '向量召回'
                      : [
                          model.capabilities.stream ? '流式' : null,
                          model.capabilities.jsonMode ? 'JSON' : null,
                          model.capabilities.toolCalling ? '工具' : null,
                        ]
                          .filter(Boolean)
                          .join(' / ') || '基础对话';

                  return (
                    <article className={`model-rich-row ${model.status === '启用' ? 'is-success' : 'is-muted'}`} key={model.id} role="listitem">
                      <div className="model-rich-identity">
                        <div className="app-project-title-row">
                          <Boxes size={17} strokeWidth={1.9} aria-hidden="true" />
                          <strong>{model.name}</strong>
                        </div>
                        <span>{model.modelId}</span>
                        <div className="app-project-subline">
                          <span className="app-catalog-meta-chip">{MODEL_TYPE_META[model.modelType].label}</span>
                          <span>{PROTOCOL_META[model.protocol]}</span>
                        </div>
                      </div>
                      <div className="model-rich-meta">
                        <span className="app-project-meta-label">供应商</span>
                        <strong>{provider?.name ?? model.providerName}</strong>
                        <span>{PROVIDER_TYPE_META[provider?.type ?? model.providerType].label}</span>
                      </div>
                      <div className="model-rich-meta">
                        <span className="app-project-meta-label">能力边界</span>
                        <strong>{limitText}</strong>
                        <span>{capabilityText}</span>
                      </div>
                      <div className="model-rich-status">
                        <QStatusChip status={model.status} />
                      </div>
                      <div className="app-project-actions">
                        <button className="app-project-icon-action" type="button" aria-label={`编辑 ${model.name}`} title="编辑模型" onClick={() => openModelDialog('edit', model)}>
                          <Pencil size={16} strokeWidth={1.8} aria-hidden="true" />
                        </button>
                        <button className="app-project-icon-action" type="button" aria-label={`${model.status === '启用' ? '停用' : '启用'} ${model.name}`} title={model.status === '启用' ? '停用' : '启用'} onClick={() => setPendingConfirm({ kind: 'model-status', model })}>
                          <ShieldCheck size={16} strokeWidth={1.8} aria-hidden="true" />
                        </button>
                        <button className="app-project-icon-action" type="button" aria-label={`测试连接 ${model.name}`} title="测试连接" onClick={() => void testModel(model)}>
                          <FlaskConical size={16} strokeWidth={1.8} aria-hidden="true" />
                        </button>
                        <button className="app-project-icon-action is-danger" type="button" aria-label={`删除 ${model.name}`} title="删除模型" onClick={() => setPendingModelDelete(model)}>
                          <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {visibleModels.length === 0 ? (
                <QEmptyState
                  title={models.length === 0 ? '暂无模型' : '暂无匹配模型'}
                  description={models.length === 0 ? '添加第一个 LLM 或 Embedding 模型，后续测试计划再引用这些模型。' : '调整筛选条件或添加新的模型配置。'}
                  action={<QButton onPress={() => openModelDialog('create')}>添加模型</QButton>}
                />
              ) : null}
        </section>
      ) : null}

      {activeTab === 'providers' ? (
        <section className="provider-tab-panel" role="tabpanel" aria-label="供应商列表">
          <div className="model-center-toolbar">
            <div className="model-center-toolbar-copy">
              <strong>供应商列表</strong>
              <span>维护全局凭证和端点；模型配置只引用这些供应商。</span>
            </div>
          </div>
          <div className="model-rich-list" role="list" aria-label="供应商列表">
            {providers.map((provider) => (
              <article className={`model-rich-row provider-rich-row ${provider.status === '启用' ? 'is-success' : 'is-muted'}`} key={provider.code} role="listitem">
                <div className="model-rich-identity">
                  <div className="app-project-title-row">
                    <ServerCog size={17} strokeWidth={1.9} aria-hidden="true" />
                    <strong>{provider.name}</strong>
                  </div>
                  <span>{provider.code}</span>
                  <div className="app-project-subline">
                    <span className="app-catalog-meta-chip">{PROVIDER_TYPE_META[provider.type].label}</span>
                  </div>
                </div>
                <div className="model-rich-meta provider-url-meta">
                  <span className="app-project-meta-label">接口地址</span>
                  <strong>{provider.baseUrl}</strong>
                  <span>全局凭证配置</span>
                </div>
                <div className="model-rich-status">
                  <QStatusChip status={provider.status} />
                </div>
                <div className="app-project-actions">
                  <button className="app-project-icon-action" type="button" aria-label={`编辑 ${provider.name}`} title="编辑供应商" onClick={() => openProviderPanel('edit', provider)}>
                    <Pencil size={16} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                  <button className="app-project-icon-action" type="button" aria-label={`${provider.status === '启用' ? '停用' : '启用'} ${provider.name}`} title={provider.status === '启用' ? '停用' : '启用'} onClick={() => setPendingConfirm({ kind: 'provider-status', provider })}>
                    <ShieldCheck size={16} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                  <button className="app-project-icon-action" type="button" aria-label={`测试 ${provider.name}`} title="测试供应商" onClick={() => void testProvider(provider)}>
                    <FlaskConical size={16} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                  <button className="app-project-icon-action is-danger" type="button" aria-label={`删除 ${provider.name}`} title="删除供应商" onClick={() => setPendingProviderDelete(provider)}>
                    <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
          {providers.length === 0 ? (
            <QEmptyState title="暂无供应商" description="先添加 OpenAI 兼容、通义千问或 DeepSeek 供应商，再绑定模型。" action={<QButton onPress={() => openProviderPanel('create')}>添加供应商</QButton>} />
          ) : null}
        </section>
      ) : null}

      <QModal isOpen={Boolean(modelDialogMode)} onOpenChange={(open) => !open && closeModelDialog()} title={modelDialogMode === 'create' ? '添加模型' : '编辑模型'} description={modelForm.name || '登记供应商侧模型 ID、能力类型和模型能力边界。'}>
        {modelDialogMode ? (
          <form className="console-dialog-form" aria-label={modelDialogMode === 'create' ? '添加模型表单' : '编辑模型表单'} noValidate onSubmit={saveModel}>
            <div className="console-form-grid">
              <QTextField label="模型名称" value={modelForm.name} errorMessage={modelErrors.name} placeholder="如 Qwen3.6-Plus" onChange={(event) => updateModelField('name', event.target.value)} />
              <QSelectField label="模型能力" selectedKey={modelForm.modelType} errorMessage={modelErrors.modelType} onSelectionChange={(key) => updateModelField('modelType', key as ModelFormState['modelType'])} options={modelTypeOptions} />
              <QSelectField label="供应商" selectedKey={modelForm.provider} errorMessage={modelErrors.provider} onSelectionChange={(key) => updateModelField('provider', String(key))} options={enabledProviderOptions.map((provider) => ({ label: providerToOptionLabel(provider), value: provider.code }))} />
              <QTextField label="供应商模型 ID" value={modelForm.modelId} errorMessage={modelErrors.modelId} placeholder={selectedModelProvider ? (modelForm.modelType === 'EMBEDDING' ? (PROVIDER_TYPE_META[selectedModelProvider.type].embeddingExample ?? '') : PROVIDER_TYPE_META[selectedModelProvider.type].llmExample) : '供应商侧模型 slug'} onChange={(event) => updateModelField('modelId', event.target.value)} />
              {modelForm.modelType === 'LLM' ? (
                <>
                  <QTextField label="上下文窗口" value={modelForm.contextWindow} errorMessage={modelErrors.contextWindow} placeholder="如 128k 或 1000000" onChange={(event) => updateModelField('contextWindow', event.target.value)} />
                  <QTextField label="最大输出 Token" value={modelForm.maxOutputTokens} errorMessage={modelErrors.maxOutputTokens} placeholder="如 4k 或 4096" onChange={(event) => updateModelField('maxOutputTokens', event.target.value)} />
                  <QSelectField label="支持流式响应" selectedKey={modelForm.stream} onSelectionChange={(key) => updateModelField('stream', String(key))} options={SUPPORT_OPTIONS} />
                  <QSelectField label="支持 JSON 输出" selectedKey={modelForm.jsonMode} onSelectionChange={(key) => updateModelField('jsonMode', String(key))} options={SUPPORT_OPTIONS} />
                  <QSelectField label="支持工具调用" selectedKey={modelForm.toolCalling} onSelectionChange={(key) => updateModelField('toolCalling', String(key))} options={SUPPORT_OPTIONS} />
                  <QSelectField label="支持推理/思考" selectedKey={modelForm.thinkingEnabled} onSelectionChange={(key) => updateModelField('thinkingEnabled', String(key))} options={SUPPORT_OPTIONS} />
                </>
              ) : (
                <QTextField label="输出维度" value={modelForm.dimensions} errorMessage={modelErrors.dimensions} inputMode="numeric" placeholder="如 1024" onChange={(event) => updateModelField('dimensions', event.target.value)} />
              )}
              <div className="model-config-hint">
                <span>能力提示</span>
                <p>{selectedModelProvider ? PROVIDER_TYPE_META[selectedModelProvider.type].configHint : '请先选择供应商。'} 当前协议：{selectedModelProvider ? PROTOCOL_META[buildModelPayload(modelForm, selectedModelProvider).protocol] : '-'}</p>
              </div>
            </div>
            <div className="console-modal-actions">
              <QButton color="default" isLoading={modelTesting} type="button" variant="secondary" onPress={() => void testModelForm()}>
                <FlaskConical size={14} strokeWidth={1.9} aria-hidden="true" />
                测试连接
              </QButton>
              <QButton color="default" type="button" variant="secondary" onPress={closeModelDialog}>
                取消
              </QButton>
              <QButton type="submit">
                <Check size={14} strokeWidth={2} aria-hidden="true" />
                保存模型
              </QButton>
            </div>
          </form>
        ) : null}
      </QModal>

      <QModal isOpen={providerDialogOpen} onOpenChange={setProviderDialogOpen} title={providerFormMode === 'create' ? '添加供应商' : '编辑供应商'} description={providerForm.name || '维护全局供应商凭证与端点，模型从这里复用配置。'}>
        <form className="console-dialog-form" aria-label={providerFormMode === 'create' ? '添加供应商表单' : '编辑供应商表单'} noValidate onSubmit={saveProvider}>
          <div className="provider-config-grid">
            <QTextField label="供应商名称" value={providerForm.name} errorMessage={providerErrors.name} placeholder="如 DeepSeek 生产环境" onChange={(event) => updateProviderField('name', event.target.value)} />
            <QSelectField label="供应商类型" selectedKey={providerForm.type} errorMessage={providerErrors.type} onSelectionChange={(key) => updateProviderType(key as ProviderType)} options={providerTypeOptions} />
            <QTextField label="接口地址" value={providerForm.baseUrl} errorMessage={providerErrors.baseUrl} placeholder={providerMeta.defaultBaseUrl} onChange={(event) => updateProviderField('baseUrl', event.target.value)} />
            <QTextField label="API Key" value={providerForm.apiKey} errorMessage={providerErrors.apiKey} placeholder="sk-..." type="password" onChange={(event) => updateProviderField('apiKey', event.target.value)} />
            <div className="model-config-hint">
              <span>供应商参数</span>
              <p>{providerMeta.configHint}</p>
            </div>
          </div>
          <div className="console-modal-actions">
            <QButton color="default" isLoading={providerTesting} type="button" variant="secondary" onPress={() => void testProviderForm()}>
              <FlaskConical size={14} strokeWidth={1.9} aria-hidden="true" />
              测试连接
            </QButton>
            <QButton color="default" type="button" variant="secondary" onPress={() => setProviderDialogOpen(false)}>
              取消
            </QButton>
            <QButton type="submit">
              <Check size={14} strokeWidth={2} aria-hidden="true" />
              保存供应商
            </QButton>
          </div>
        </form>
      </QModal>

      <QConfirmDialog
        isOpen={Boolean(pendingModelDelete)}
        title="删除模型确认"
        description={pendingModelDelete ? `确认删除 ${pendingModelDelete.name}？删除后，测试策略后续需要重新选择模型。` : ''}
        confirmLabel="确认删除"
        onOpenChange={(open) => !open && setPendingModelDelete(null)}
        onConfirm={() => void deleteModel()}
      />
      <QConfirmDialog
        isOpen={Boolean(pendingProviderDelete)}
        title="删除供应商确认"
        description={pendingProviderDelete ? `确认删除 ${pendingProviderDelete.name}？删除前请确认没有模型引用该供应商。` : ''}
        confirmLabel="确认删除"
        onOpenChange={(open) => !open && setPendingProviderDelete(null)}
        onConfirm={() => void deleteProvider()}
      />
      <QConfirmDialog
        isOpen={Boolean(pendingConfirm)}
        title={pendingConfirm?.kind === 'model-status' ? `确认${pendingConfirm.model.status === '启用' ? '停用' : '启用'}这个模型？` : `确认${pendingConfirm?.provider.status === '启用' ? '停用' : '启用'}这个供应商？`}
        description={pendingConfirm?.kind === 'model-status' ? `该模型会被${pendingConfirm.model.status === '启用' ? '停用' : '启用'}，历史执行记录不会变化。` : `该供应商会被${pendingConfirm?.provider.status === '启用' ? '停用' : '启用'}，已创建模型仍会保留配置。`}
        confirmLabel="确认"
        onOpenChange={(open) => !open && setPendingConfirm(null)}
        onConfirm={() => {
          if (pendingConfirm?.kind === 'model-status') void toggleModelStatus(pendingConfirm.model);
          if (pendingConfirm?.kind === 'provider-status') void toggleProviderStatus(pendingConfirm.provider);
        }}
      />
    </section>
  );
}
