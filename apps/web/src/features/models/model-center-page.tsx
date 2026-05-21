'use client';

import { Card, CardContent as CardBody, CardHeader, Chip, Tab, Tabs, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { Boxes, Check, FlaskConical, Pencil, Plus, Search, ServerCog, ShieldCheck, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { getGatewayApiUrl } from '@ai-quality-platform/shared-config';
import { QButton, QConfirmDialog, QDataTable, QEmptyState, QModal, QSelectField, QStatusChip, QTextField } from '@/components/qtp-ui';
import { buildModelForm, buildModelPayload, buildProviderForm, formatTokenDisplay, MODEL_TYPE_META, PROVIDER_TYPE_META, PROTOCOL_META, SUPPORT_OPTIONS, providerToOptionLabel } from './model-center-schema';
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

function toStatusLabel(enabled: boolean): StatusLabel {
  return enabled ? '启用' : '停用';
}

function toNumber(value: string, fallback?: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : fallback;
}

function parseTokenInput(value: string, fallback?: number) {
  const normalized = value.trim().replace(/,/g, '').replace(/\s+/g, '').toLowerCase();
  if (!normalized) return fallback;
  const match = normalized.match(/^(\d+(?:\.\d+)?)([km])?$/);
  if (!match) return fallback;
  const multiplier = match[2] === 'm' ? 1_000_000 : match[2] === 'k' ? 1_000 : 1;
  const parsed = Number(match[1]) * multiplier;
  return Number.isFinite(parsed) && parsed > 0 && Number.isInteger(parsed) ? parsed : fallback;
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

function buildLocalProviderCode(name: string, type: ProviderType, existingProviders: ModelProviderRecord[]) {
  const nameSlug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const baseCode = `provider-${nameSlug || type.toLowerCase().replace(/_/g, '-')}`;
  const usedCodes = new Set(existingProviders.map((provider) => provider.code));
  let nextCode = baseCode;
  let index = 2;
  while (usedCodes.has(nextCode)) {
    nextCode = `${baseCode}-${index}`;
    index += 1;
  }
  return nextCode;
}

async function postAi(path: string, payload: Record<string, unknown>) {
  const response = await fetch(getGatewayApiUrl('ai', path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => ({}))) as GatewayMessage & Record<string, unknown>;
  if (!response.ok || result.success === false) {
    throw new Error(result.message ?? result.data?.message ?? '操作失败');
  }
  return result;
}

function mutationMessage(result: GatewayMessage, fallback: string) {
  return result.message ?? result.data?.message ?? fallback;
}

/**
 * @author codex
 * Renders the HeroUI POC Model Center while preserving the original console workflows.
 */
export function ModelCenterPage({ initialModels, initialProviders }: ModelCenterPageProps) {
  useModelCenterData({ models: initialModels, providers: initialProviders });
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

  const notify = (message: string) => {
    setActionMessage(message);
    toast(message);
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
      if (!parseTokenInput(modelForm.contextWindow)) errors.contextWindow = '请输入有效 token 数量，例如 128k 或 1000000。';
      if (!parseTokenInput(modelForm.maxOutputTokens)) errors.maxOutputTokens = '请输入有效 token 数量，例如 4k 或 4096。';
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
      const saved = (await mutations.saveProvider.mutateAsync({
        form: providerForm,
        editingProviderCode: providerFormMode === 'edit' ? editingProviderCode : undefined,
      })) as Record<string, unknown>;
      const generatedCode = providerFormMode === 'create' ? buildLocalProviderCode(providerForm.name, providerForm.type, providers) : editingProviderCode;
      const nextProvider: ModelProviderRecord = {
        id: String(saved.providerCode ?? generatedCode),
        code: String(saved.providerCode ?? generatedCode),
        name: String(saved.providerName ?? providerForm.name.trim()),
        type: (saved.providerType ?? providerForm.type) as ProviderType,
        baseUrl: String(saved.baseUrl ?? providerForm.baseUrl.trim()),
        apiKey: String(saved.apiKey ?? providerForm.apiKey.trim()),
        status: toStatusLabel(saved.enabled !== false),
      };
      setProviders((current) =>
        providerFormMode === 'edit' ? current.map((provider) => (provider.code === nextProvider.code ? nextProvider : provider)) : [nextProvider, ...current],
      );
      setModels((current) => current.map((model) => (model.provider === nextProvider.code ? { ...model, providerName: nextProvider.name, providerType: nextProvider.type } : model)));
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
      const saved = (await mutations.saveModel.mutateAsync({
        form: modelForm,
        provider,
        editingModelId: modelDialogMode === 'edit' ? editingModelId : undefined,
      })) as Record<string, unknown>;
      const payload = buildModelPayload(modelForm, provider);
      const id = String(saved.id ?? (modelDialogMode === 'edit' ? editingModelId : Date.now()));
      const nextModel: ModelCenterRecord = {
        id,
        name: String(saved.modelName ?? payload.modelName),
        provider: String(saved.providerCode ?? provider.code),
        providerName: provider.name,
        providerType: provider.type,
        modelId: String(saved.modelId ?? payload.modelId),
        modelType: payload.modelType,
        protocol: payload.protocol,
        parameters: (saved.parameters as ModelCenterRecord['parameters'] | undefined) ?? payload.parameters,
        capabilities: (saved.capabilities as ModelCenterRecord['capabilities'] | undefined) ?? payload.capabilities,
        limits: (saved.limits as ModelCenterRecord['limits'] | undefined) ?? payload.limits,
        status: toStatusLabel(saved.enabled !== false),
      };
      setModels((current) => (modelDialogMode === 'edit' ? current.map((model) => (model.id === nextModel.id ? nextModel : model)) : [nextModel, ...current]));
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
      const result = await postAi('/provider/test-config.do', {
        providerType: providerForm.type,
        baseUrl: providerForm.baseUrl.trim(),
        apiKey: providerForm.apiKey.trim(),
      });
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
      const result = await postAi('/provider/model/test-config.do', buildModelPayload(modelForm, provider));
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
      <Card className="model-center-surface" variant="secondary">
        <CardHeader className="model-center-heading">
          <div>
            <div className="model-center-title-line">
              <h1>模型中心</h1>
              <Chip color="accent" size="sm" variant="soft">
                HeroUI POC
              </Chip>
            </div>
            <p>以模型资产为主维护 LLM 与 Embedding 能力；供应商仅作为可复用的全局凭证与端点配置。</p>
          </div>
          <span className="model-center-summary">
            {models.filter((model) => model.status === '启用').length} 个模型启用 · {providers.filter((provider) => provider.status === '启用').length} 个供应商启用
          </span>
        </CardHeader>
        <CardBody>
          {actionMessage ? (
            <div className="console-message" role="status">
              {actionMessage}
            </div>
          ) : null}

          <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key as ModelCenterTab)} variant="secondary">
            <Tabs.List aria-label="模型中心管理" className="preset-admin-tabs model-center-tabs">
              <Tab id="models">
                <Boxes size={14} strokeWidth={1.9} aria-hidden="true" />
                模型列表
                <span>{models.length}</span>
              </Tab>
              <Tab id="providers">
                <ServerCog size={14} strokeWidth={1.9} aria-hidden="true" />
                供应商列表
                <span>{providers.length}</span>
              </Tab>
            </Tabs.List>
          </Tabs>

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
                <QButton onPress={() => openModelDialog('create')}>
                  <Plus size={14} strokeWidth={2} aria-hidden="true" />
                  添加模型
                </QButton>
              </div>

              <QDataTable aria-label="模型列表">
                <TableHeader>
                  <TableColumn isRowHeader>模型</TableColumn>
                  <TableColumn>能力</TableColumn>
                  <TableColumn isRowHeader>供应商</TableColumn>
                  <TableColumn>模型 ID</TableColumn>
                  <TableColumn>协议</TableColumn>
                  <TableColumn>能力边界</TableColumn>
                  <TableColumn>状态</TableColumn>
                  <TableColumn>操作</TableColumn>
                </TableHeader>
                <TableBody>
                  {visibleModels.map((model) => {
                    const provider = providersByCode.get(model.provider);
                    return (
                      <TableRow id={model.id} key={model.id}>
                        <TableCell>
                          <strong className="model-name-cell">{model.name}</strong>
                          <span>{model.id}</span>
                        </TableCell>
                        <TableCell>{MODEL_TYPE_META[model.modelType].label}</TableCell>
                        <TableCell>
                          <span className="model-provider-badge">{provider?.name ?? model.providerName}</span>
                          <small>{PROVIDER_TYPE_META[provider?.type ?? model.providerType].label}</small>
                        </TableCell>
                        <TableCell>{model.modelId}</TableCell>
                        <TableCell>{PROTOCOL_META[model.protocol]}</TableCell>
                        <TableCell>
                          {model.modelType === 'EMBEDDING'
                            ? `${model.limits.embeddingDimensions ?? model.parameters.dimensions ?? '-'} 维`
                            : `${formatTokenDisplay(model.limits.contextWindow)} ctx / ${formatTokenDisplay(model.limits.maxOutputTokens ?? model.parameters.maxOutputTokens)} out`}
                        </TableCell>
                        <TableCell>
                          <QStatusChip status={model.status} />
                        </TableCell>
                        <TableCell>
                          <div className="console-row-actions">
                            <QButton color="default" variant="secondary" onPress={() => openModelDialog('edit', model)}>
                              <Pencil size={13} strokeWidth={1.9} aria-hidden="true" />
                              编辑
                            </QButton>
                            <QButton color="default" variant="secondary" onPress={() => setPendingConfirm({ kind: 'model-status', model })}>
                              <ShieldCheck size={13} strokeWidth={1.9} aria-hidden="true" />
                              {model.status === '启用' ? '停用' : '启用'}
                            </QButton>
                            <QButton color="default" variant="secondary" onPress={() => void testModel(model)}>
                              <FlaskConical size={13} strokeWidth={1.9} aria-hidden="true" />
                              测试连接
                            </QButton>
                            <QButton color="danger" onPress={() => setPendingModelDelete(model)}>
                              <Trash2 size={13} strokeWidth={1.9} aria-hidden="true" />
                              删除
                            </QButton>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </QDataTable>
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
                <QButton onPress={() => openProviderPanel('create')}>
                  <Plus size={14} strokeWidth={2} aria-hidden="true" />
                  添加供应商
                </QButton>
              </div>
              <QDataTable aria-label="供应商列表">
                <TableHeader>
                  <TableColumn isRowHeader>供应商</TableColumn>
                  <TableColumn>类型</TableColumn>
                  <TableColumn>接口地址</TableColumn>
                  <TableColumn>状态</TableColumn>
                  <TableColumn>操作</TableColumn>
                </TableHeader>
                <TableBody>
                  {providers.map((provider) => (
                    <TableRow id={provider.code} key={provider.code}>
                      <TableCell>
                        <strong className="model-name-cell">{provider.name}</strong>
                      </TableCell>
                      <TableCell>{PROVIDER_TYPE_META[provider.type].label}</TableCell>
                      <TableCell>{provider.baseUrl}</TableCell>
                      <TableCell>
                        <QStatusChip status={provider.status} />
                      </TableCell>
                      <TableCell>
                        <div className="console-row-actions">
                          <QButton color="default" variant="secondary" onPress={() => openProviderPanel('edit', provider)}>
                            <Pencil size={13} strokeWidth={1.9} aria-hidden="true" />
                            编辑
                          </QButton>
                          <QButton color="default" variant="secondary" onPress={() => setPendingConfirm({ kind: 'provider-status', provider })}>
                            <ShieldCheck size={13} strokeWidth={1.9} aria-hidden="true" />
                            {provider.status === '启用' ? '停用' : '启用'}
                          </QButton>
                          <QButton color="default" variant="secondary" onPress={() => void testProvider(provider)}>
                            <FlaskConical size={13} strokeWidth={1.9} aria-hidden="true" />
                            测试
                          </QButton>
                          <QButton color="danger" onPress={() => setPendingProviderDelete(provider)}>
                            <Trash2 size={13} strokeWidth={1.9} aria-hidden="true" />
                            删除
                          </QButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </QDataTable>
              {providers.length === 0 ? (
                <QEmptyState title="暂无供应商" description="先添加 OpenAI 兼容、通义千问或 DeepSeek 供应商，再绑定模型。" action={<QButton onPress={() => openProviderPanel('create')}>添加供应商</QButton>} />
              ) : null}
            </section>
          ) : null}
        </CardBody>
      </Card>

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
