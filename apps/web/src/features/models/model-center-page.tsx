'use client';

import { FormEvent, useMemo, useState } from 'react';
import { getGatewayApiUrl } from '@ai-quality-platform/shared-config';
import {
  Boxes,
  Check,
  FlaskConical,
  Pencil,
  Plus,
  Search,
  ServerCog,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConsoleSelect, DialogContent, DialogRoot, PopoverConfirm, TextInput } from '@/components/ui';

type ProviderType = 'OPENAI_COMPATIBLE' | 'QWEN' | 'DEEPSEEK';
type ModelPurpose = 'JUDGE' | 'EXECUTION' | 'EMBEDDING';
type StatusLabel = '启用' | '停用';
type DialogMode = 'create' | 'edit';
type ModelCenterTab = 'models' | 'providers';

export interface ModelProviderRecord {
  id: string;
  code: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  status: StatusLabel;
}

export interface ModelCenterRecord {
  id: string;
  code: string;
  name: string;
  provider: string;
  providerName: string;
  providerType: ProviderType;
  modelId: string;
  purpose: ModelPurpose;
  context: string;
  temperature: string;
  status: StatusLabel;
}

interface ModelCenterPageProps {
  initialModels: ModelCenterRecord[];
  initialProviders: ModelProviderRecord[];
}

interface ModelFormState {
  code: string;
  name: string;
  provider: string;
  modelId: string;
  purpose: ModelPurpose;
  context: string;
  temperature: string;
}

interface ProviderFormState {
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  enabled: boolean;
}

interface GatewayResponse {
  success?: boolean;
  message?: string;
  data?: Record<string, unknown> & {
    message?: string;
  };
}

type ProviderSaveResponse = GatewayResponse & Partial<ProviderRecordResponse>;

interface ProviderRecordResponse {
  providerCode: string;
  providerName: string;
  providerType: ProviderType;
  baseUrl: string;
  apiKey?: string;
  defaultModel?: string;
  enabled?: boolean;
}

const PROVIDER_TYPE_META: Record<
  ProviderType,
  { label: string; defaultBaseUrl: string; modelExample: string; configHint: string }
> = {
  OPENAI_COMPATIBLE: {
    label: 'OpenAI 兼容',
    defaultBaseUrl: 'https://api.openai.com/v1',
    modelExample: 'your-model-id',
    configHint: '需要 Base URL 与 API Key；模型 ID 通常在添加模型时直接填写供应商侧 slug。',
  },
  QWEN: {
    label: '通义千问',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelExample: 'qwen-plus',
    configHint: '需要 DashScope API Key；模型 ID 建议填写 qwen-plus、qwen-max 等实际可调用模型。',
  },
  DEEPSEEK: {
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    modelExample: 'deepseek-chat',
    configHint: '需要 DeepSeek API Key；模型 ID 可填写 deepseek-chat 或 deepseek-reasoner。',
  },
};

const PURPOSE_META: Record<ModelPurpose, { label: string; description: string }> = {
  JUDGE: { label: '评估模型', description: '用于评分、复核、质量判断' },
  EXECUTION: { label: '执行模型', description: '用于调用被测应用或生成样本' },
  EMBEDDING: { label: 'Embedding', description: '用于相似度、召回、向量检索' },
};

function buildModelForm(providerCode = ''): ModelFormState {
  return {
    code: '',
    name: '',
    provider: providerCode,
    modelId: '',
    purpose: 'JUDGE',
    context: '128000',
    temperature: '0.2',
  };
}

function buildProviderForm(type: ProviderType = 'OPENAI_COMPATIBLE'): ProviderFormState {
  return {
    name: '',
    type,
    baseUrl: '',
    apiKey: '',
    defaultModel: '',
    enabled: true,
  };
}

function providerToForm(provider: ModelProviderRecord): ProviderFormState {
  return {
    name: provider.name,
    type: provider.type,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    defaultModel: provider.defaultModel,
    enabled: provider.status === '启用',
  };
}

function modelToForm(model: ModelCenterRecord): ModelFormState {
  return {
    code: model.code,
    name: model.name,
    provider: model.provider,
    modelId: model.modelId,
    purpose: model.purpose,
    context: model.context,
    temperature: model.temperature,
  };
}

function toStatusLabel(enabled: boolean): StatusLabel {
  return enabled ? '启用' : '停用';
}

function toNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildLocalProviderCode(name: string, type: ProviderType, existingProviders: ModelProviderRecord[]) {
  const nameSlug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const typeSlug = type.toLowerCase().replace(/_/g, '-');
  const baseCode = `provider-${nameSlug || typeSlug}`;
  const usedCodes = new Set(existingProviders.map((provider) => provider.code));
  let nextCode = baseCode;
  let index = 2;
  while (usedCodes.has(nextCode)) {
    nextCode = `${baseCode}-${index}`;
    index += 1;
  }
  return nextCode;
}

function readSavedProvider(result: ProviderSaveResponse): Partial<ProviderRecordResponse> {
  if (result.data?.providerCode) {
    return result.data as Partial<ProviderRecordResponse>;
  }
  return result;
}

async function postAi(path: string, payload: Record<string, unknown>) {
  const response = await fetch(getGatewayApiUrl('ai', path), {
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
 * Presents models and global providers as sibling management tabs.
 */
export function ModelCenterPage({ initialModels, initialProviders }: ModelCenterPageProps) {
  const [models, setModels] = useState(initialModels);
  const [providers, setProviders] = useState(initialProviders);
  const [activeTab, setActiveTab] = useState<ModelCenterTab>('models');
  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('全部');
  const [statusFilter, setStatusFilter] = useState<'全部' | StatusLabel>('全部');
  const [modelDialogMode, setModelDialogMode] = useState<DialogMode | null>(null);
  const [modelForm, setModelForm] = useState<ModelFormState>(() => buildModelForm(initialProviders[0]?.code ?? ''));
  const [providerPanelOpen, setProviderPanelOpen] = useState(false);
  const [providerFormMode, setProviderFormMode] = useState<DialogMode>('create');
  const [providerForm, setProviderForm] = useState<ProviderFormState>(() => buildProviderForm());
  const [editingProviderCode, setEditingProviderCode] = useState('');
  const [providerTesting, setProviderTesting] = useState(false);
  const [pendingModelDelete, setPendingModelDelete] = useState<ModelCenterRecord | null>(null);
  const [pendingProviderDelete, setPendingProviderDelete] = useState<ModelProviderRecord | null>(null);
  const [actionMessage, setActionMessage] = useState('');

  const notify = (message: string) => {
    setActionMessage(message);
    toast(message);
  };

  const providersByCode = useMemo(() => new Map(providers.map((provider) => [provider.code, provider])), [providers]);
  const enabledProviderOptions = useMemo(
    () => providers.filter((provider) => provider.status === '启用'),
    [providers],
  );

  const visibleModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return models.filter((model) => {
      const provider = providersByCode.get(model.provider);
      const searchable = [
        model.code,
        model.name,
        model.modelId,
        model.provider,
        model.providerName,
        provider?.name,
        provider?.type,
        PURPOSE_META[model.purpose].label,
      ]
        .join(' ')
        .toLowerCase();
      return (
        (!normalizedQuery || searchable.includes(normalizedQuery)) &&
        (providerFilter === '全部' || model.provider === providerFilter) &&
        (statusFilter === '全部' || model.status === statusFilter)
      );
    });
  }, [models, providerFilter, providersByCode, query, statusFilter]);

  const enabledModels = models.filter((model) => model.status === '启用').length;
  const enabledProviders = providers.filter((provider) => provider.status === '启用').length;

  const openModelDialog = (mode: DialogMode, model?: ModelCenterRecord) => {
    if (mode === 'create' && enabledProviderOptions.length === 0) {
      notify('请先添加或启用至少一个供应商，再添加模型');
      setActiveTab('providers');
      openProviderPanel('create');
      return;
    }
    setModelDialogMode(mode);
    setModelForm(
      mode === 'edit' && model ? modelToForm(model) : buildModelForm(enabledProviderOptions[0]?.code ?? ''),
    );
  };

  const openProviderPanel = (mode: DialogMode, provider?: ModelProviderRecord) => {
    setActiveTab('providers');
    setProviderPanelOpen(true);
    setProviderFormMode(mode);
    setEditingProviderCode(mode === 'edit' && provider ? provider.code : '');
    setProviderForm(mode === 'edit' && provider ? providerToForm(provider) : buildProviderForm());
  };

  const closeModelDialog = () => {
    setModelDialogMode(null);
    setModelForm(buildModelForm(enabledProviderOptions[0]?.code ?? ''));
  };

  const updateProviderType = (nextType: ProviderType) => {
    setProviderForm((current) => {
      const providerPreset = PROVIDER_TYPE_META[nextType];
      return {
        ...current,
        type: nextType,
        baseUrl: current.baseUrl || providerPreset.defaultBaseUrl,
        defaultModel: current.defaultModel || providerPreset.modelExample,
      };
    });
  };

  const saveModel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const provider = providersByCode.get(modelForm.provider);
    if (!provider) {
      notify('请选择有效供应商');
      return;
    }
    if (provider.status !== '启用') {
      notify('请选择启用状态的供应商');
      return;
    }
    const payload = {
      modelCode: modelForm.code.trim(),
      modelName: modelForm.name.trim(),
      providerCode: modelForm.provider,
      modelId: modelForm.modelId.trim(),
      purpose: modelForm.purpose,
      contextWindow: toNumber(modelForm.context, 0),
      temperature: toNumber(modelForm.temperature, 0),
    };
    try {
      if (modelDialogMode === 'edit') {
        await postAi('/provider/model/update.do', {
          modelCode: modelForm.code,
          data: {
            modelName: payload.modelName,
            providerCode: payload.providerCode,
            modelId: payload.modelId,
            purpose: payload.purpose,
            contextWindow: payload.contextWindow,
            temperature: payload.temperature,
          },
        });
      } else {
        await postAi('/provider/model/create.do', payload);
      }
      const nextModel: ModelCenterRecord = {
        id: payload.modelCode,
        code: payload.modelCode,
        name: payload.modelName,
        provider: provider.code,
        providerName: provider.name,
        providerType: provider.type,
        modelId: payload.modelId,
        purpose: payload.purpose,
        context: String(payload.contextWindow),
        temperature: String(payload.temperature),
        status: models.find((model) => model.code === payload.modelCode)?.status ?? '启用',
      };
      setModels((current) =>
        modelDialogMode === 'edit'
          ? current.map((model) => (model.code === nextModel.code ? nextModel : model))
          : [nextModel, ...current],
      );
      notify(modelDialogMode === 'edit' ? '模型已更新' : '模型已添加');
      closeModelDialog();
    } catch (error) {
      notify(error instanceof Error ? error.message : '模型保存失败');
    }
  };

  const saveProvider = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      providerName: providerForm.name.trim(),
      providerType: providerForm.type,
      baseUrl: providerForm.baseUrl.trim(),
      apiKey: providerForm.apiKey.trim(),
      defaultModel: providerForm.defaultModel.trim() || PROVIDER_TYPE_META[providerForm.type].modelExample,
      enabled: providerFormMode === 'create' ? true : providerForm.enabled,
    };
    try {
      let savedProvider: Partial<ProviderRecordResponse> = {};
      if (providerFormMode === 'edit') {
        if (!editingProviderCode) {
          notify('供应商不存在，请刷新后重试');
          return;
        }
        const result = (await postAi('/provider/update.do', {
          providerCode: editingProviderCode,
          data: {
            providerName: payload.providerName,
            providerType: payload.providerType,
            baseUrl: payload.baseUrl,
            apiKey: payload.apiKey,
            defaultModel: payload.defaultModel,
            enabled: payload.enabled,
          },
        })) as ProviderSaveResponse;
        savedProvider = readSavedProvider(result);
      } else {
        const result = (await postAi('/provider/create.do', payload)) as ProviderSaveResponse;
        savedProvider = readSavedProvider(result);
      }
      const nextProviderCode =
        savedProvider.providerCode ||
        (providerFormMode === 'edit'
          ? editingProviderCode
          : buildLocalProviderCode(payload.providerName, payload.providerType, providers));
      const nextProvider: ModelProviderRecord = {
        id: nextProviderCode,
        code: nextProviderCode,
        name: savedProvider.providerName ?? payload.providerName,
        type: savedProvider.providerType ?? payload.providerType,
        baseUrl: savedProvider.baseUrl ?? payload.baseUrl,
        apiKey: savedProvider.apiKey ?? payload.apiKey,
        defaultModel: savedProvider.defaultModel ?? payload.defaultModel,
        status: toStatusLabel(savedProvider.enabled ?? payload.enabled),
      };
      setProviders((current) =>
        providerFormMode === 'edit'
          ? current.map((provider) => (provider.code === nextProvider.code ? nextProvider : provider))
          : [nextProvider, ...current],
      );
      setModels((current) =>
        current.map((model) =>
          model.provider === nextProvider.code
            ? { ...model, providerName: nextProvider.name, providerType: nextProvider.type }
            : model,
        ),
      );
      setModelForm((current) => ({
        ...current,
        provider: current.provider || (nextProvider.status === '启用' ? nextProvider.code : ''),
      }));
      notify(providerFormMode === 'edit' ? '供应商配置已更新' : '供应商已添加，可在新增模型时选择');
      setProviderFormMode('create');
      setProviderForm(buildProviderForm());
      setEditingProviderCode('');
      setProviderPanelOpen(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : '供应商保存失败');
    }
  };

  const toggleModelStatus = async (model: ModelCenterRecord) => {
    const enabled = model.status !== '启用';
    try {
      await postAi('/provider/model/change-status.do', { modelCode: model.code, enabled });
      setModels((current) =>
        current.map((item) => (item.code === model.code ? { ...item, status: toStatusLabel(enabled) } : item)),
      );
      notify(enabled ? '模型已启用' : '模型已停用');
    } catch (error) {
      notify(error instanceof Error ? error.message : '模型状态更新失败');
    }
  };

  const toggleProviderStatus = async (provider: ModelProviderRecord) => {
    const enabled = provider.status !== '启用';
    try {
      await postAi('/provider/change-status.do', { providerCode: provider.code, enabled });
      setProviders((current) =>
        current.map((item) => (item.code === provider.code ? { ...item, status: toStatusLabel(enabled) } : item)),
      );
      notify(enabled ? '供应商已启用' : '供应商已停用');
    } catch (error) {
      notify(error instanceof Error ? error.message : '供应商状态更新失败');
    }
  };

  const testModel = async (model: ModelCenterRecord) => {
    try {
      const result = await postAi('/provider/model/test-connection.do', { modelCode: model.code });
      notify(result.message ?? result.data?.message ?? '模型连接配置可用');
    } catch (error) {
      notify(error instanceof Error ? error.message : '模型连接测试失败');
    }
  };

  const testProvider = async (provider: ModelProviderRecord) => {
    try {
      const result = await postAi('/provider/test-connection.do', { providerCode: provider.code });
      notify(result.message ?? result.data?.message ?? '供应商连接配置可用');
    } catch (error) {
      notify(error instanceof Error ? error.message : '供应商连接测试失败');
    }
  };

  const testProviderForm = async () => {
    if (!providerForm.baseUrl.trim() || !providerForm.apiKey.trim()) {
      notify('请先填写接口地址和 API Key');
      return;
    }
    setProviderTesting(true);
    try {
      const result = await postAi('/provider/test-config.do', {
        providerType: providerForm.type,
        baseUrl: providerForm.baseUrl.trim(),
        apiKey: providerForm.apiKey.trim(),
      });
      notify(result.message ?? result.data?.message ?? '供应商连接测试完成');
    } catch (error) {
      notify(error instanceof Error ? error.message : '供应商连接测试失败');
    } finally {
      setProviderTesting(false);
    }
  };

  const deleteModel = async () => {
    if (!pendingModelDelete) return;
    try {
      await postAi('/provider/model/delete.do', { modelCode: pendingModelDelete.code });
      setModels((current) => current.filter((model) => model.code !== pendingModelDelete.code));
      setPendingModelDelete(null);
      notify('模型已删除');
    } catch (error) {
      notify(error instanceof Error ? error.message : '模型删除失败');
    }
  };

  const deleteProvider = async () => {
    if (!pendingProviderDelete) return;
    if (models.some((model) => model.provider === pendingProviderDelete.code)) {
      notify('该供应商下仍有模型，请先迁移或删除相关模型');
      setPendingProviderDelete(null);
      return;
    }
    try {
      await postAi('/provider/delete.do', { providerCode: pendingProviderDelete.code });
      setProviders((current) => current.filter((provider) => provider.code !== pendingProviderDelete.code));
      setPendingProviderDelete(null);
      notify('供应商已删除');
    } catch (error) {
      notify(error instanceof Error ? error.message : '供应商删除失败');
    }
  };

  const providerMeta = PROVIDER_TYPE_META[providerForm.type];
  const selectedModelProvider = providersByCode.get(modelForm.provider);
  const modelProviderOptions =
    modelDialogMode === 'edit'
      ? providers.filter((provider) => provider.status === '启用' || provider.code === modelForm.provider)
      : enabledProviderOptions;

  return (
    <section className="model-center-page" aria-label="模型中心">
      <header className="console-heading model-center-heading">
        <div>
          <h1>模型中心</h1>
          <p>以模型为主维护评估、执行和 Embedding 能力；供应商仅作为可复用的全局凭证与端点配置。</p>
        </div>
        <span className="console-soft-badge">
          {enabledModels} 个模型启用 · {enabledProviders} 个供应商启用
        </span>
      </header>

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
      <div className="model-center-grid" role="tabpanel" aria-label="模型列表">
        <section className="model-center-surface" aria-label="模型列表">
          <div className="model-center-toolbar">
            <TextInput
              aria-label="搜索模型"
              className="console-search"
              prefix={<Search size={15} strokeWidth={1.9} aria-hidden="true" />}
              value={query}
              placeholder="搜索模型名称、模型 ID、供应商或用途"
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="model-filter-group" aria-label="模型筛选">
              <ConsoleSelect
                ariaLabel="按供应商筛选"
                value={providerFilter}
                onValueChange={setProviderFilter}
                options={[
                  { label: '全部供应商', value: '全部' },
                  ...providers.map((provider) => ({ label: provider.name, value: provider.code })),
                ]}
              />
              <ConsoleSelect
                ariaLabel="按状态筛选"
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as '全部' | StatusLabel)}
                options={[
                  { label: '全部状态', value: '全部' },
                  { label: '启用', value: '启用' },
                  { label: '停用', value: '停用' },
                ]}
              />
            </div>
            <button className="console-button console-button-primary" type="button" onClick={() => openModelDialog('create')}>
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              添加模型
            </button>
          </div>

          <div className="model-table-wrap">
            <table className="console-table model-table">
              <thead>
                <tr>
                  <th>模型</th>
                  <th>供应商</th>
                  <th>模型 ID</th>
                  <th>用途</th>
                  <th>上下文</th>
                  <th>温度</th>
                  <th>状态</th>
                  <th className="console-action-cell">操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleModels.map((model) => {
                  const provider = providersByCode.get(model.provider);
                  return (
                    <tr key={model.code}>
                      <td>
                        <strong className="model-name-cell">{model.name}</strong>
                        <span>{model.code}</span>
                      </td>
                      <td>
                        <span className="model-provider-badge">{provider?.name ?? model.providerName}</span>
                        <small>{PROVIDER_TYPE_META[provider?.type ?? model.providerType].label}</small>
                      </td>
                      <td>{model.modelId}</td>
                      <td>{PURPOSE_META[model.purpose].label}</td>
                      <td>{Number(model.context).toLocaleString()}</td>
                      <td>{model.temperature}</td>
                      <td>
                        <span className={`console-status-pill console-status-${model.status}`}>{model.status}</span>
                      </td>
                      <td className="console-row-actions">
                        <button type="button" onClick={() => openModelDialog('edit', model)}>
                          <Pencil size={13} strokeWidth={1.9} aria-hidden="true" />
                          编辑
                        </button>
                        <PopoverConfirm
                          aria-label="模型状态变更确认"
                          description={`该模型会被${model.status === '启用' ? '停用' : '启用'}，历史执行记录不会变化。`}
                          onConfirm={() => void toggleModelStatus(model)}
                          title={`确认${model.status === '启用' ? '停用' : '启用'}这个模型？`}
                        >
                          <button type="button">
                            <ShieldCheck size={13} strokeWidth={1.9} aria-hidden="true" />
                            {model.status === '启用' ? '停用' : '启用'}
                          </button>
                        </PopoverConfirm>
                        <button type="button" onClick={() => testModel(model)}>
                          <FlaskConical size={13} strokeWidth={1.9} aria-hidden="true" />
                          测试连接
                        </button>
                        <button className="is-danger" type="button" onClick={() => setPendingModelDelete(model)}>
                          <Trash2 size={13} strokeWidth={1.9} aria-hidden="true" />
                          删除
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {visibleModels.length === 0 ? (
                  <tr>
                    <td className="console-empty" colSpan={8}>
                      <strong>{models.length === 0 ? '暂无模型' : '暂无匹配模型'}</strong>
                      <p>{models.length === 0 ? '添加第一个评估、执行或 Embedding 模型。' : '调整筛选条件或添加新的模型配置。'}</p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      ) : null}

      {activeTab === 'providers' ? (
        <section className="model-center-surface provider-tab-panel" role="tabpanel" aria-label="供应商列表">
          <div className="model-center-toolbar">
            <div className="model-center-toolbar-copy">
              <strong>供应商列表</strong>
              <span>维护全局凭证和端点；模型配置只引用这些供应商。</span>
            </div>
            <button className="console-button console-button-primary" type="button" onClick={() => openProviderPanel('create')}>
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              添加供应商
            </button>
          </div>
          <div className="model-table-wrap">
            <table className="console-table model-provider-table">
              <thead>
                <tr>
                  <th>供应商</th>
                  <th>类型</th>
                  <th>接口地址</th>
                  <th>状态</th>
                  <th className="console-action-cell">操作</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((provider) => (
                  <tr key={provider.code}>
                    <td>
                      <strong className="model-name-cell">{provider.name}</strong>
                    </td>
                    <td>{PROVIDER_TYPE_META[provider.type].label}</td>
                    <td className="model-provider-url">{provider.baseUrl}</td>
                    <td>
                      <span className={`console-status-pill console-status-${provider.status}`}>{provider.status}</span>
                    </td>
                    <td className="console-row-actions">
                      <button type="button" onClick={() => openProviderPanel('edit', provider)}>
                        <Pencil size={13} strokeWidth={1.9} aria-hidden="true" />
                        编辑
                      </button>
                      <PopoverConfirm
                        aria-label="供应商状态变更确认"
                        description={`该供应商会被${provider.status === '启用' ? '停用' : '启用'}，已创建模型仍会保留配置。`}
                        onConfirm={() => void toggleProviderStatus(provider)}
                        title={`确认${provider.status === '启用' ? '停用' : '启用'}这个供应商？`}
                      >
                        <button type="button">
                          <ShieldCheck size={13} strokeWidth={1.9} aria-hidden="true" />
                          {provider.status === '启用' ? '停用' : '启用'}
                        </button>
                      </PopoverConfirm>
                      <button type="button" onClick={() => testProvider(provider)}>
                        <FlaskConical size={13} strokeWidth={1.9} aria-hidden="true" />
                        测试
                      </button>
                      <button className="is-danger" type="button" onClick={() => setPendingProviderDelete(provider)}>
                        <Trash2 size={13} strokeWidth={1.9} aria-hidden="true" />
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
                {providers.length === 0 ? (
                  <tr>
                    <td className="console-empty" colSpan={5}>
                      <strong>暂无供应商</strong>
                      <p>先添加 OpenAI 兼容、通义千问或 DeepSeek 供应商，再绑定模型。</p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <DialogRoot open={Boolean(modelDialogMode)} onOpenChange={(open) => !open && closeModelDialog()}>
        {modelDialogMode ? (
          <DialogContent
            className="model-editor-modal"
            description={modelForm.name || '绑定供应商侧模型 ID、用途和默认调用参数。'}
            title={modelDialogMode === 'create' ? '添加模型' : '编辑模型'}
          >
          <form className="console-dialog-form" aria-label={modelDialogMode === 'create' ? '添加模型表单' : '编辑模型表单'} onSubmit={saveModel}>
            <div className="console-form-grid">
              <TextInput
                className="console-form-field"
                label="模型编码"
                value={modelForm.code}
                disabled={modelDialogMode === 'edit'}
                required
                placeholder="如 deepseek-chat-judge"
                onChange={(event) => setModelForm((current) => ({ ...current, code: event.target.value }))}
              />
              <TextInput
                className="console-form-field"
                label="模型名称"
                value={modelForm.name}
                required
                placeholder="如 DeepSeek 评估模型"
                onChange={(event) => setModelForm((current) => ({ ...current, name: event.target.value }))}
              />
              <label className="console-form-field">
                <span>供应商</span>
                <ConsoleSelect
                  ariaLabel="供应商"
                  value={modelForm.provider}
                  onValueChange={(value) => setModelForm((current) => ({ ...current, provider: value }))}
                  placeholder="请选择供应商"
                  options={modelProviderOptions.map((provider) => ({
                    label: `${provider.name} (${PROVIDER_TYPE_META[provider.type].label}${provider.status === '启用' ? '' : ' / 停用'})`,
                    value: provider.code,
                  }))}
                />
              </label>
              <TextInput
                className="console-form-field"
                label="供应商模型 ID"
                value={modelForm.modelId}
                required
                placeholder={selectedModelProvider?.defaultModel || '供应商侧模型 slug'}
                onChange={(event) => setModelForm((current) => ({ ...current, modelId: event.target.value }))}
              />
              <label className="console-form-field">
                <span>用途</span>
                <ConsoleSelect
                  ariaLabel="用途"
                  value={modelForm.purpose}
                  onValueChange={(value) => setModelForm((current) => ({ ...current, purpose: value as ModelPurpose }))}
                  options={(Object.keys(PURPOSE_META) as ModelPurpose[]).map((purpose) => ({ label: PURPOSE_META[purpose].label, value: purpose }))}
                />
              </label>
              <TextInput
                className="console-form-field"
                label="上下文窗口"
                value={modelForm.context}
                inputMode="numeric"
                onChange={(event) => setModelForm((current) => ({ ...current, context: event.target.value }))}
              />
              <TextInput
                className="console-form-field"
                label="默认温度"
                value={modelForm.temperature}
                inputMode="decimal"
                onChange={(event) => setModelForm((current) => ({ ...current, temperature: event.target.value }))}
              />
              <div className="model-config-hint">
                <span>配置提示</span>
                <p>{selectedModelProvider ? PROVIDER_TYPE_META[selectedModelProvider.type].configHint : '请先选择供应商。'}</p>
              </div>
            </div>
            <div className="console-modal-actions">
              <button className="console-button" type="button" onClick={closeModelDialog}>
                取消
              </button>
              <button className="console-button console-button-primary" type="submit">
                <Check size={14} strokeWidth={2} aria-hidden="true" />
                保存模型
              </button>
            </div>
          </form>
          </DialogContent>
        ) : null}
      </DialogRoot>

      <DialogRoot open={providerPanelOpen} onOpenChange={setProviderPanelOpen}>
        {providerPanelOpen ? (
          <DialogContent
            className="provider-config-modal"
            description={providerForm.name || '维护全局供应商凭证与端点，模型从这里复用配置。'}
            title={providerFormMode === 'create' ? '添加供应商' : '编辑供应商'}
          >
          <form className="console-dialog-form" aria-label={providerFormMode === 'create' ? '添加供应商表单' : '编辑供应商表单'} onSubmit={saveProvider}>
            <div className="provider-config-grid">
              <TextInput
                className="console-form-field"
                label="供应商名称"
                value={providerForm.name}
                required
                placeholder="如 DeepSeek 生产环境"
                onChange={(event) => setProviderForm((current) => ({ ...current, name: event.target.value }))}
              />
              <label className="console-form-field">
                <span>供应商类型</span>
                <ConsoleSelect
                  ariaLabel="供应商类型"
                  value={providerForm.type}
                  onValueChange={(value) => updateProviderType(value as ProviderType)}
                  options={(Object.keys(PROVIDER_TYPE_META) as ProviderType[]).map((type) => ({ label: PROVIDER_TYPE_META[type].label, value: type }))}
                />
              </label>
              <TextInput
                className="console-form-field is-wide"
                label="接口地址"
                value={providerForm.baseUrl}
                required
                placeholder={providerMeta.defaultBaseUrl}
                onChange={(event) => setProviderForm((current) => ({ ...current, baseUrl: event.target.value }))}
              />
              <TextInput
                className="console-form-field is-wide"
                label="API Key"
                value={providerForm.apiKey}
                required
                type="password"
                placeholder="sk-..."
                onChange={(event) => setProviderForm((current) => ({ ...current, apiKey: event.target.value }))}
              />
              <div className="model-config-hint is-wide">
                <span>供应商参数</span>
                <p>{providerMeta.configHint}</p>
              </div>
            </div>
            <div className="console-modal-actions">
              <button
                className="console-button provider-config-test-button"
                disabled={providerTesting}
                type="button"
                onClick={testProviderForm}
              >
                <FlaskConical size={14} strokeWidth={1.9} aria-hidden="true" />
                {providerTesting ? '测试中' : '测试连接'}
              </button>
              {providerFormMode === 'edit' ? (
                <button className="console-button" type="button" onClick={() => openProviderPanel('create')}>
                  新增模式
                </button>
              ) : null}
              <button className="console-button" type="button" onClick={() => setProviderPanelOpen(false)}>
                取消
              </button>
              <button className="console-button console-button-primary" type="submit">
                <Check size={14} strokeWidth={2} aria-hidden="true" />
                保存供应商
              </button>
            </div>
          </form>
          </DialogContent>
        ) : null}
      </DialogRoot>

      <DialogRoot open={Boolean(pendingModelDelete)} onOpenChange={(open) => !open && setPendingModelDelete(null)}>
        {pendingModelDelete ? (
          <DialogContent
            description={`确认删除 ${pendingModelDelete.name}？已绑定计划后续需要重新选择模型。`}
            footer={
              <>
                <button className="console-button" type="button" onClick={() => setPendingModelDelete(null)}>
                  取消
                </button>
                <button className="console-button console-button-danger" type="button" onClick={deleteModel}>
                  <Trash2 size={14} strokeWidth={1.9} aria-hidden="true" />
                  确认删除
                </button>
              </>
            }
            title="删除模型确认"
          />
        ) : null}
      </DialogRoot>

      <DialogRoot open={Boolean(pendingProviderDelete)} onOpenChange={(open) => !open && setPendingProviderDelete(null)}>
        {pendingProviderDelete ? (
          <DialogContent
            description={`确认删除 ${pendingProviderDelete.name}？如果该供应商仍有关联模型，系统会阻止删除。`}
            footer={
              <>
                <button className="console-button" type="button" onClick={() => setPendingProviderDelete(null)}>
                  取消
                </button>
                <button className="console-button console-button-danger" type="button" onClick={deleteProvider}>
                  <Trash2 size={14} strokeWidth={1.9} aria-hidden="true" />
                  确认删除
                </button>
              </>
            }
            title="删除供应商确认"
          />
        ) : null}
      </DialogRoot>
    </section>
  );
}
