'use client';

import { FormEvent, useMemo, useState } from 'react';
import { getGatewayApiUrl } from '@ai-quality-platform/shared-config';
import { Boxes, Check, FlaskConical, Pencil, Plus, Search, ServerCog, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConsoleSelect, DialogContent, DialogRoot, PopoverConfirm, TextInput } from '@/components/ui';

type ProviderType = 'OPENAI_COMPATIBLE' | 'QWEN' | 'DEEPSEEK';
type ModelType = 'LLM' | 'EMBEDDING';
type ModelProtocol =
  | 'OPENAI_CHAT_COMPLETIONS'
  | 'OPENAI_EMBEDDINGS'
  | 'DASHSCOPE_COMPATIBLE_CHAT'
  | 'DASHSCOPE_COMPATIBLE_EMBEDDINGS'
  | 'DEEPSEEK_CHAT_COMPLETIONS';
type StatusLabel = '启用' | '停用';
type DialogMode = 'create' | 'edit';
type ModelCenterTab = 'models' | 'providers';

interface ModelParameters {
  batchSize?: number;
  dimensions?: number;
  encodingFormat?: 'float' | 'base64';
  jsonMode?: boolean;
  maxOutputTokens?: number;
  reasoningEffort?: 'low' | 'medium' | 'high' | 'max';
  stream?: boolean;
  temperature?: number;
  thinkingEnabled?: boolean;
  timeoutMs?: number;
  toolCalling?: boolean;
  topK?: number;
  topP?: number;
}

interface ModelCapabilities {
  embedding?: boolean;
  jsonMode?: boolean;
  reasoning?: boolean;
  stream?: boolean;
  toolCalling?: boolean;
}

interface ModelLimits {
  contextWindow?: number;
  embeddingDimensions?: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
}

export interface ModelProviderRecord {
  id: string;
  code: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
  status: StatusLabel;
}

export interface ModelCenterRecord {
  id: string;
  name: string;
  provider: string;
  providerName: string;
  providerType: ProviderType;
  modelId: string;
  modelType: ModelType;
  protocol: ModelProtocol;
  parameters: ModelParameters;
  capabilities: ModelCapabilities;
  limits: ModelLimits;
  status: StatusLabel;
}

interface ModelCenterPageProps {
  initialModels: ModelCenterRecord[];
  initialProviders: ModelProviderRecord[];
}

interface ModelFormState {
  name: string;
  provider: string;
  modelId: string;
  modelType: ModelType;
  contextWindow: string;
  maxOutputTokens: string;
  stream: string;
  jsonMode: string;
  toolCalling: string;
  thinkingEnabled: string;
  dimensions: string;
}

interface ProviderFormState {
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
}

interface GatewayResponse {
  success?: boolean;
  message?: string;
  data?: Record<string, unknown> & {
    message?: string;
  };
}

type FieldErrors<T> = Partial<Record<keyof T, string>>;
type ModelRecordResponse = Partial<ModelCenterRecord> & Record<string, unknown>;
type ProviderSaveResponse = GatewayResponse &
  Partial<{
    providerCode: string;
    providerName: string;
    providerType: ProviderType;
    baseUrl: string;
    apiKey: string;
    enabled: boolean;
  }>;

const PROVIDER_TYPE_META: Record<ProviderType, { label: string; defaultBaseUrl: string; llmExample: string; embeddingExample?: string; configHint: string }> = {
  OPENAI_COMPATIBLE: {
    label: 'OpenAI 兼容',
    defaultBaseUrl: 'https://api.openai.com/v1',
    llmExample: 'gpt-4.1-mini',
    embeddingExample: 'text-embedding-3-large',
    configHint: '适合 OpenAI、自建网关、OpenRouter、Vercel AI Gateway 等 /v1 兼容端点，按实际模型记录能力支持情况。',
  },
  QWEN: {
    label: '阿里云百炼（通义千问）',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    llmExample: 'qwen-plus',
    embeddingExample: 'text-embedding-v4',
    configHint: '默认使用百炼 OpenAI 兼容模式；LLM 与 Embedding 分开登记，参数在调用策略中单独维护。',
  },
  DEEPSEEK: {
    label: 'DeepSeek 官方',
    defaultBaseUrl: 'https://api.deepseek.com',
    llmExample: 'deepseek-chat',
    configHint: 'DeepSeek 官方端点用于 Chat 模型；当前不作为 Embedding 供应商。',
  },
};

const MODEL_TYPE_META: Record<ModelType, { label: string; description: string }> = {
  LLM: { label: 'LLM', description: '对话、评估、工具调用和结构化输出' },
  EMBEDDING: { label: 'Embedding', description: '向量化、相似度、召回和检索' },
};

const PROTOCOL_META: Record<ModelProtocol, string> = {
  OPENAI_CHAT_COMPLETIONS: 'OpenAI Chat Completions',
  OPENAI_EMBEDDINGS: 'OpenAI Embeddings',
  DASHSCOPE_COMPATIBLE_CHAT: '百炼兼容 Chat',
  DASHSCOPE_COMPATIBLE_EMBEDDINGS: '百炼兼容 Embeddings',
  DEEPSEEK_CHAT_COMPLETIONS: 'DeepSeek Chat Completions',
};

const SUPPORT_OPTIONS = [
  { label: '支持', value: 'true' },
  { label: '不支持', value: 'false' },
];

function buildModelForm(providerCode = '', providerType: ProviderType = 'OPENAI_COMPATIBLE', modelType: ModelType = 'LLM'): ModelFormState {
  const providerMeta = PROVIDER_TYPE_META[providerType];
  return {
    name: '',
    provider: providerCode,
    modelId: modelType === 'EMBEDDING' ? (providerMeta.embeddingExample ?? '') : providerMeta.llmExample,
    modelType,
    contextWindow: '128k',
    maxOutputTokens: '4096',
    stream: 'true',
    jsonMode: providerType === 'DEEPSEEK' ? 'false' : 'true',
    toolCalling: providerType === 'DEEPSEEK' ? 'false' : 'true',
    thinkingEnabled: providerType === 'DEEPSEEK' ? 'true' : 'false',
    dimensions: modelType === 'EMBEDDING' ? '1024' : '',
  };
}

function buildProviderForm(type: ProviderType = 'OPENAI_COMPATIBLE'): ProviderFormState {
  return {
    name: '',
    type,
    baseUrl: '',
    apiKey: '',
  };
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

function toStatusLabel(enabled: boolean): StatusLabel {
  return enabled ? '启用' : '停用';
}

function toNumber(value: string, fallback?: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : fallback;
}

function parseTokenCount(value: string, fallback?: number) {
  const normalized = value.trim().replace(/,/g, '').replace(/\s+/g, '').toLowerCase();
  if (!normalized) return fallback;
  const match = normalized.match(/^(\d+(?:\.\d+)?)([km])?$/);
  if (!match) return fallback;
  const unit = match[2];
  const multiplier = unit === 'm' ? 1_000_000 : unit === 'k' ? 1_000 : 1;
  const parsed = Number(match[1]) * multiplier;
  return Number.isFinite(parsed) && parsed > 0 && Number.isInteger(parsed) ? parsed : fallback;
}

function formatTokenInput(value?: number) {
  if (!value) return '';
  if (value % 1_000_000 === 0) return `${value / 1_000_000}m`;
  if (value % 1_000 === 0) return `${value / 1_000}k`;
  return String(value);
}

function formatTokenDisplay(value?: number) {
  if (!value) return '-';
  if (value % 1_000_000 === 0) return `${value / 1_000_000}M`;
  if (value % 1_000 === 0) return `${value / 1_000}K`;
  return value.toLocaleString();
}

function toBoolean(value: string) {
  return value === 'true';
}

function resolveProtocol(providerType: ProviderType, modelType: ModelType): ModelProtocol {
  if (providerType === 'QWEN') return modelType === 'EMBEDDING' ? 'DASHSCOPE_COMPATIBLE_EMBEDDINGS' : 'DASHSCOPE_COMPATIBLE_CHAT';
  if (providerType === 'DEEPSEEK') return 'DEEPSEEK_CHAT_COMPLETIONS';
  return modelType === 'EMBEDDING' ? 'OPENAI_EMBEDDINGS' : 'OPENAI_CHAT_COMPLETIONS';
}

function readSavedProvider(result: ProviderSaveResponse): Partial<ProviderSaveResponse> {
  if (result.data?.providerCode) return result.data as Partial<ProviderSaveResponse>;
  return result;
}

function readSavedModel(result: GatewayResponse & ModelRecordResponse): ModelRecordResponse {
  if (result.data?.id) return result.data as ModelRecordResponse;
  return result;
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

async function postAi(path: string, payload: Record<string, unknown>) {
  const response = await fetch(getGatewayApiUrl('ai', path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => ({}))) as GatewayResponse & Record<string, unknown>;
  if (!response.ok || result.success === false) {
    throw new Error(result.message ?? result.data?.message ?? '操作失败');
  }
  return result;
}

/**
 * @author codex
 * Presents models and global providers as sibling management tabs with provider-aware model parameters.
 */
export function ModelCenterPage({ initialModels, initialProviders }: ModelCenterPageProps) {
  const [models, setModels] = useState(initialModels);
  const [providers, setProviders] = useState(initialProviders);
  const [activeTab, setActiveTab] = useState<ModelCenterTab>('models');
  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('全部');
  const [modelTypeFilter, setModelTypeFilter] = useState<'全部' | ModelType>('全部');
  const [statusFilter, setStatusFilter] = useState<'全部' | StatusLabel>('全部');
  const [modelDialogMode, setModelDialogMode] = useState<DialogMode | null>(null);
  const [modelForm, setModelForm] = useState<ModelFormState>(() => buildModelForm(initialProviders[0]?.code ?? '', initialProviders[0]?.type));
  const [modelErrors, setModelErrors] = useState<FieldErrors<ModelFormState>>({});
  const [modelTesting, setModelTesting] = useState(false);
  const [editingModelId, setEditingModelId] = useState('');
  const [providerPanelOpen, setProviderPanelOpen] = useState(false);
  const [providerFormMode, setProviderFormMode] = useState<DialogMode>('create');
  const [providerForm, setProviderForm] = useState<ProviderFormState>(() => buildProviderForm());
  const [providerErrors, setProviderErrors] = useState<FieldErrors<ProviderFormState>>({});
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

  const enabledModels = models.filter((model) => model.status === '启用').length;
  const enabledProviders = providers.filter((provider) => provider.status === '启用').length;

  const updateModelField = <K extends keyof ModelFormState>(key: K, value: ModelFormState[K]) => {
    setModelForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'provider') {
        const provider = providersByCode.get(String(value));
        return { ...buildModelForm(String(value), provider?.type, current.modelType), name: current.name };
      }
      if (key === 'modelType') {
        return { ...buildModelForm(current.provider, selectedModelProvider?.type, value as ModelType), name: current.name };
      }
      return next;
    });
    setModelErrors((current) => ({ ...current, [key]: undefined }));
  };

  const updateProviderField = <K extends keyof ProviderFormState>(key: K, value: ProviderFormState[K]) => {
    setProviderForm((current) => ({ ...current, [key]: value }));
    setProviderErrors((current) => ({ ...current, [key]: undefined }));
  };

  const openModelDialog = (mode: DialogMode, model?: ModelCenterRecord) => {
    if (mode === 'create' && enabledProviderOptions.length === 0) {
      notify('请先添加或启用至少一个供应商，再添加模型');
      setActiveTab('providers');
      openProviderPanel('create');
      return;
    }
    setModelErrors({});
    setModelDialogMode(mode);
    setEditingModelId(mode === 'edit' && model ? model.id : '');
    setModelForm(mode === 'edit' && model ? modelToForm(model) : buildModelForm(enabledProviderOptions[0]?.code ?? '', enabledProviderOptions[0]?.type));
  };

  const openProviderPanel = (mode: DialogMode, provider?: ModelProviderRecord) => {
    setActiveTab('providers');
    setProviderPanelOpen(true);
    setProviderErrors({});
    setProviderFormMode(mode);
    setEditingProviderCode(mode === 'edit' && provider ? provider.code : '');
    setProviderForm(mode === 'edit' && provider ? providerToForm(provider) : buildProviderForm());
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

  const buildModelPayload = () => {
    const provider = providersByCode.get(modelForm.provider);
    const modelType = modelForm.modelType;
    const parameters =
      modelType === 'EMBEDDING'
        ? {
            dimensions: toNumber(modelForm.dimensions),
          }
        : {
            maxOutputTokens: parseTokenCount(modelForm.maxOutputTokens, 4096),
            stream: toBoolean(modelForm.stream),
            jsonMode: toBoolean(modelForm.jsonMode),
            toolCalling: toBoolean(modelForm.toolCalling),
            thinkingEnabled: toBoolean(modelForm.thinkingEnabled),
          };
    const capabilities =
      modelType === 'EMBEDDING'
        ? { embedding: true }
        : {
            stream: toBoolean(modelForm.stream),
            jsonMode: toBoolean(modelForm.jsonMode),
            toolCalling: toBoolean(modelForm.toolCalling),
            reasoning: toBoolean(modelForm.thinkingEnabled),
          };
    const limits =
      modelType === 'EMBEDDING'
        ? {
            embeddingDimensions: toNumber(modelForm.dimensions),
            maxInputTokens: 8192,
          }
        : {
            contextWindow: parseTokenCount(modelForm.contextWindow, 128000),
            maxOutputTokens: parseTokenCount(modelForm.maxOutputTokens, 4096),
          };
    return {
      modelName: modelForm.name.trim(),
      providerCode: modelForm.provider,
      modelId: modelForm.modelId.trim(),
      modelType,
      protocol: resolveProtocol(provider?.type ?? 'OPENAI_COMPATIBLE', modelType),
      parameters,
      capabilities,
      limits,
    };
  };

  const saveModel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateModelForm()) return;
    const provider = providersByCode.get(modelForm.provider);
    if (!provider || provider.status !== '启用') {
      notify('请选择启用状态的供应商');
      return;
    }
    const payload = buildModelPayload();
    try {
      const result =
        modelDialogMode === 'edit'
          ? await postAi('/provider/model/update.do', { id: editingModelId, data: payload })
          : await postAi('/provider/model/create.do', payload);
      const saved = readSavedModel(result);
      const id = String(saved.id ?? (modelDialogMode === 'edit' ? editingModelId : Date.now()));
      const nextModel: ModelCenterRecord = {
        id,
        name: String(saved.modelName ?? payload.modelName),
        provider: String(saved.providerCode ?? provider.code),
        providerName: provider.name,
        providerType: provider.type,
        modelId: String(saved.modelId ?? payload.modelId),
        modelType: String(saved.modelType ?? payload.modelType) as ModelType,
        protocol: String(saved.protocol ?? payload.protocol) as ModelProtocol,
        parameters: (saved.parameters as ModelParameters | undefined) ?? payload.parameters,
        capabilities: (saved.capabilities as ModelCapabilities | undefined) ?? payload.capabilities,
        limits: (saved.limits as ModelLimits | undefined) ?? payload.limits,
        status: toStatusLabel(saved.enabled !== false),
      };
      setModels((current) => (modelDialogMode === 'edit' ? current.map((model) => (model.id === nextModel.id ? nextModel : model)) : [nextModel, ...current]));
      notify(modelDialogMode === 'edit' ? '模型已更新' : '模型已添加');
      closeModelDialog();
    } catch (error) {
      notify(error instanceof Error ? error.message : '模型保存失败');
    }
  };

  const saveProvider = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateProviderForm()) return;
    const payload = {
      providerName: providerForm.name.trim(),
      providerType: providerForm.type,
      baseUrl: providerForm.baseUrl.trim(),
      apiKey: providerForm.apiKey.trim(),
      enabled: true,
    };
    try {
      const result =
        providerFormMode === 'edit'
          ? await postAi('/provider/update.do', { providerCode: editingProviderCode, data: payload })
          : await postAi('/provider/create.do', payload);
      const savedProvider = readSavedProvider(result);
      const generatedCode = providerFormMode === 'create' ? buildLocalProviderCode(payload.providerName, payload.providerType, providers) : editingProviderCode;
      const nextProvider: ModelProviderRecord = {
        id: String(savedProvider.providerCode ?? generatedCode),
        code: String(savedProvider.providerCode ?? generatedCode),
        name: String(savedProvider.providerName ?? payload.providerName),
        type: (savedProvider.providerType ?? payload.providerType) as ProviderType,
        baseUrl: String(savedProvider.baseUrl ?? payload.baseUrl),
        apiKey: String(savedProvider.apiKey ?? payload.apiKey),
        status: toStatusLabel(savedProvider.enabled !== false),
      };
      setProviders((current) =>
        providerFormMode === 'edit'
          ? current.map((provider) => (provider.code === nextProvider.code ? nextProvider : provider))
          : [nextProvider, ...current],
      );
      setModels((current) =>
        current.map((model) =>
          model.provider === nextProvider.code ? { ...model, providerName: nextProvider.name, providerType: nextProvider.type } : model,
        ),
      );
      notify(providerFormMode === 'edit' ? '供应商已更新' : '供应商已添加');
      setProviderPanelOpen(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : '供应商保存失败');
    }
  };

  const toggleModelStatus = async (model: ModelCenterRecord) => {
    const enabled = model.status !== '启用';
    try {
      await postAi('/provider/model/change-status.do', { id: model.id, enabled });
      setModels((current) => current.map((item) => (item.id === model.id ? { ...item, status: toStatusLabel(enabled) } : item)));
      notify(enabled ? '模型已启用' : '模型已停用');
    } catch (error) {
      notify(error instanceof Error ? error.message : '状态更新失败');
    }
  };

  const toggleProviderStatus = async (provider: ModelProviderRecord) => {
    const enabled = provider.status !== '启用';
    try {
      await postAi('/provider/change-status.do', { providerCode: provider.code, enabled });
      setProviders((current) => current.map((item) => (item.code === provider.code ? { ...item, status: toStatusLabel(enabled) } : item)));
      notify(enabled ? '供应商已启用' : '供应商已停用');
    } catch (error) {
      notify(error instanceof Error ? error.message : '状态更新失败');
    }
  };

  const testModel = async (model: ModelCenterRecord) => {
    try {
      const result = await postAi('/provider/model/test-connection.do', { id: model.id });
      notify(result.message ?? result.data?.message ?? '模型测试完成');
    } catch (error) {
      notify(error instanceof Error ? error.message : '模型测试失败');
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
      const result = await postAi('/provider/model/test-config.do', buildModelPayload());
      notify(result.message ?? result.data?.message ?? '模型测试完成');
    } catch (error) {
      notify(error instanceof Error ? error.message : '模型测试失败');
    } finally {
      setModelTesting(false);
    }
  };

  const testProvider = async (provider: ModelProviderRecord) => {
    try {
      const result = await postAi('/provider/test-connection.do', { providerCode: provider.code });
      notify(result.message ?? result.data?.message ?? '供应商测试完成');
    } catch (error) {
      notify(error instanceof Error ? error.message : '供应商测试失败');
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
      notify(result.message ?? result.data?.message ?? '供应商测试完成');
    } catch (error) {
      notify(error instanceof Error ? error.message : '供应商测试失败');
    } finally {
      setProviderTesting(false);
    }
  };

  const deleteModel = async () => {
    if (!pendingModelDelete) return;
    try {
      await postAi('/provider/model/delete.do', { id: pendingModelDelete.id });
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
      await postAi('/provider/delete.do', { providerCode: pendingProviderDelete.code });
      setProviders((current) => current.filter((provider) => provider.code !== pendingProviderDelete.code));
      notify('供应商已删除');
      setPendingProviderDelete(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : '供应商删除失败');
    }
  };

  return (
    <section className="model-center-page">
      <header className="model-center-heading">
        <div>
          <h1>模型中心</h1>
          <p>以模型资产为主维护 LLM 与 Embedding 能力；供应商仅作为可复用的全局凭证与端点配置。</p>
        </div>
        <span className="model-center-summary">
          {enabledModels} 个模型启用 · {enabledProviders} 个供应商启用
        </span>
      </header>

      {actionMessage ? (
        <div className="console-message" role="status">
          {actionMessage}
        </div>
      ) : null}

      {providers.length === 0 ? <div className="console-message">请先添加或启用至少一个供应商，再添加模型。</div> : null}

      <div className="preset-admin-tabs model-center-tabs" role="tablist" aria-label="模型中心管理">
        <button aria-selected={activeTab === 'models'} className={activeTab === 'models' ? 'is-active' : ''} role="tab" type="button" onClick={() => setActiveTab('models')}>
          <Boxes size={14} strokeWidth={1.9} aria-hidden="true" />
          模型列表
          <span>{models.length}</span>
        </button>
        <button aria-selected={activeTab === 'providers'} className={activeTab === 'providers' ? 'is-active' : ''} role="tab" type="button" onClick={() => setActiveTab('providers')}>
          <ServerCog size={14} strokeWidth={1.9} aria-hidden="true" />
          供应商列表
          <span>{providers.length}</span>
        </button>
      </div>

      {activeTab === 'models' ? (
        <div className="model-center-grid" role="tabpanel" aria-label="模型列表">
          <section className="model-center-surface" aria-label="模型列表">
            <div className="model-center-toolbar">
              <TextInput aria-label="搜索模型" className="console-search" prefix={<Search size={15} strokeWidth={1.9} aria-hidden="true" />} value={query} placeholder="搜索模型名称、模型 ID、供应商或协议" onChange={(event) => setQuery(event.target.value)} />
              <div className="model-filter-group" aria-label="模型筛选">
                <ConsoleSelect ariaLabel="按模型能力筛选" value={modelTypeFilter} onValueChange={(value) => setModelTypeFilter(value as '全部' | ModelType)} options={[{ label: '全部能力', value: '全部' }, ...Object.entries(MODEL_TYPE_META).map(([value, meta]) => ({ label: meta.label, value }))]} />
                <ConsoleSelect ariaLabel="按供应商筛选" value={providerFilter} onValueChange={setProviderFilter} options={[{ label: '全部供应商', value: '全部' }, ...providers.map((provider) => ({ label: provider.name, value: provider.code }))]} />
                <ConsoleSelect ariaLabel="按状态筛选" value={statusFilter} onValueChange={(value) => setStatusFilter(value as '全部' | StatusLabel)} options={[{ label: '全部状态', value: '全部' }, { label: '启用', value: '启用' }, { label: '停用', value: '停用' }]} />
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
                    <th>能力</th>
                    <th>供应商</th>
                    <th>模型 ID</th>
                    <th>协议</th>
                    <th>能力边界</th>
                    <th>状态</th>
                    <th className="console-action-cell">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleModels.map((model) => {
                    const provider = providersByCode.get(model.provider);
                    return (
                      <tr key={model.id}>
                        <td>
                          <strong className="model-name-cell">{model.name}</strong>
                          <span>{model.id}</span>
                        </td>
                        <td>{MODEL_TYPE_META[model.modelType].label}</td>
                        <td>
                          <span className="model-provider-badge">{provider?.name ?? model.providerName}</span>
                          <small>{PROVIDER_TYPE_META[provider?.type ?? model.providerType].label}</small>
                        </td>
                        <td>{model.modelId}</td>
                        <td>{PROTOCOL_META[model.protocol]}</td>
                        <td>{model.modelType === 'EMBEDDING' ? `${model.limits.embeddingDimensions ?? model.parameters.dimensions ?? '-'} 维` : `${formatTokenDisplay(model.limits.contextWindow)} ctx / ${formatTokenDisplay(model.limits.maxOutputTokens ?? model.parameters.maxOutputTokens)} out`}</td>
                        <td>
                          <span className={`console-status-pill console-status-${model.status}`}>{model.status}</span>
                        </td>
                        <td className="console-row-actions">
                          <button type="button" onClick={() => openModelDialog('edit', model)}>
                            <Pencil size={13} strokeWidth={1.9} aria-hidden="true" />
                            编辑
                          </button>
                          <PopoverConfirm aria-label="模型状态变更确认" description={`该模型会被${model.status === '启用' ? '停用' : '启用'}，历史执行记录不会变化。`} onConfirm={() => void toggleModelStatus(model)} title={`确认${model.status === '启用' ? '停用' : '启用'}这个模型？`}>
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
                </tbody>
              </table>
              {visibleModels.length === 0 ? (
                <div className="model-empty-state">
                  <strong>{models.length === 0 ? '暂无模型' : '暂无匹配模型'}</strong>
                  <span>{models.length === 0 ? '添加第一个 LLM 或 Embedding 模型，后续测试计划再引用这些模型。' : '调整筛选条件或添加新的模型配置。'}</span>
                  <button className="console-button" type="button" onClick={() => openModelDialog('create')}>
                    添加模型
                  </button>
                </div>
              ) : null}
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
                      <PopoverConfirm aria-label="供应商状态变更确认" description={`该供应商会被${provider.status === '启用' ? '停用' : '启用'}，已创建模型仍会保留配置。`} onConfirm={() => void toggleProviderStatus(provider)} title={`确认${provider.status === '启用' ? '停用' : '启用'}这个供应商？`}>
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
              </tbody>
            </table>
            {providers.length === 0 ? (
              <div className="model-empty-state">
                <strong>暂无供应商</strong>
                <span>先添加 OpenAI 兼容、通义千问或 DeepSeek 供应商，再绑定模型。</span>
                <button className="console-button" type="button" onClick={() => openProviderPanel('create')}>
                  添加供应商
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <DialogRoot open={Boolean(modelDialogMode)} onOpenChange={(open) => !open && closeModelDialog()}>
        {modelDialogMode ? (
          <DialogContent className="model-editor-modal" description={modelForm.name || '登记供应商侧模型 ID、能力类型和模型能力边界。'} title={modelDialogMode === 'create' ? '添加模型' : '编辑模型'}>
            <form className="console-dialog-form" aria-label={modelDialogMode === 'create' ? '添加模型表单' : '编辑模型表单'} noValidate onSubmit={saveModel}>
              <div className="console-form-grid">
                <TextInput className="console-form-field" label="模型名称" value={modelForm.name} error={modelErrors.name} required placeholder="如 Qwen3.6-Plus" onChange={(event) => updateModelField('name', event.target.value)} />
                <ConsoleSelect className="console-form-field" ariaLabel="模型能力" label="模型能力" required value={modelForm.modelType} error={modelErrors.modelType} onValueChange={(value) => updateModelField('modelType', value as ModelType)} options={(Object.keys(MODEL_TYPE_META) as ModelType[]).map((type) => ({ label: MODEL_TYPE_META[type].label, value: type }))} />
                <ConsoleSelect className="console-form-field" ariaLabel="供应商" label="供应商" required value={modelForm.provider} error={modelErrors.provider} onValueChange={(value) => updateModelField('provider', value)} placeholder="请选择供应商" options={enabledProviderOptions.map((provider) => ({ label: `${provider.name} (${PROVIDER_TYPE_META[provider.type].label})`, value: provider.code }))} />
                <TextInput className="console-form-field" label="供应商模型 ID" value={modelForm.modelId} error={modelErrors.modelId} required placeholder={selectedModelProvider ? (modelForm.modelType === 'EMBEDDING' ? (PROVIDER_TYPE_META[selectedModelProvider.type].embeddingExample ?? '') : PROVIDER_TYPE_META[selectedModelProvider.type].llmExample) : '供应商侧模型 slug'} onChange={(event) => updateModelField('modelId', event.target.value)} />
                {modelForm.modelType === 'LLM' ? (
                  <>
                    <TextInput className="console-form-field" label="上下文窗口" value={modelForm.contextWindow} error={modelErrors.contextWindow} required placeholder="如 128k 或 1000000" onChange={(event) => updateModelField('contextWindow', event.target.value)} />
                    <TextInput className="console-form-field" label="最大输出 Token" value={modelForm.maxOutputTokens} error={modelErrors.maxOutputTokens} required placeholder="如 4k 或 4096" onChange={(event) => updateModelField('maxOutputTokens', event.target.value)} />
                    <ConsoleSelect className="console-form-field" ariaLabel="支持流式响应" label="支持流式响应" value={modelForm.stream} onValueChange={(value) => updateModelField('stream', value)} options={SUPPORT_OPTIONS} />
                    <ConsoleSelect className="console-form-field" ariaLabel="支持 JSON 输出" label="支持 JSON 输出" value={modelForm.jsonMode} onValueChange={(value) => updateModelField('jsonMode', value)} options={SUPPORT_OPTIONS} />
                    <ConsoleSelect className="console-form-field" ariaLabel="支持工具调用" label="支持工具调用" value={modelForm.toolCalling} onValueChange={(value) => updateModelField('toolCalling', value)} options={SUPPORT_OPTIONS} />
                    <ConsoleSelect className="console-form-field" ariaLabel="支持推理思考" label="支持推理/思考" value={modelForm.thinkingEnabled} onValueChange={(value) => updateModelField('thinkingEnabled', value)} options={SUPPORT_OPTIONS} />
                  </>
                ) : (
                  <>
                    <TextInput className="console-form-field" label="输出维度" value={modelForm.dimensions} error={modelErrors.dimensions} inputMode="numeric" placeholder="如 1024" onChange={(event) => updateModelField('dimensions', event.target.value)} />
                  </>
                )}
                <div className="model-config-hint">
                  <span>能力提示</span>
                  <p>{selectedModelProvider ? PROVIDER_TYPE_META[selectedModelProvider.type].configHint : '请先选择供应商。'} 当前协议：{selectedModelProvider ? PROTOCOL_META[resolveProtocol(selectedModelProvider.type, modelForm.modelType)] : '-'}</p>
                </div>
              </div>
              <div className="console-modal-actions">
                <button className="console-button provider-config-test-button" disabled={modelTesting} type="button" onClick={testModelForm}>
                  <FlaskConical size={14} strokeWidth={1.9} aria-hidden="true" />
                  {modelTesting ? '测试中' : '测试连接'}
                </button>
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
          <DialogContent className="provider-config-modal" description={providerForm.name || '维护全局供应商凭证与端点，模型从这里复用配置。'} title={providerFormMode === 'create' ? '添加供应商' : '编辑供应商'}>
            <form className="console-dialog-form" aria-label={providerFormMode === 'create' ? '添加供应商表单' : '编辑供应商表单'} noValidate onSubmit={saveProvider}>
              <div className="provider-config-grid">
                <TextInput className="console-form-field" label="供应商名称" value={providerForm.name} error={providerErrors.name} required placeholder="如 DeepSeek 生产环境" onChange={(event) => updateProviderField('name', event.target.value)} />
                <ConsoleSelect className="console-form-field" ariaLabel="供应商类型" label="供应商类型" required value={providerForm.type} error={providerErrors.type} onValueChange={(value) => updateProviderType(value as ProviderType)} options={(Object.keys(PROVIDER_TYPE_META) as ProviderType[]).map((type) => ({ label: PROVIDER_TYPE_META[type].label, value: type }))} />
                <TextInput className="console-form-field is-wide" label="接口地址" value={providerForm.baseUrl} error={providerErrors.baseUrl} required placeholder={providerMeta.defaultBaseUrl} onChange={(event) => updateProviderField('baseUrl', event.target.value)} />
                <TextInput className="console-form-field is-wide" label="API Key" value={providerForm.apiKey} error={providerErrors.apiKey} required type="password" placeholder="sk-..." onChange={(event) => updateProviderField('apiKey', event.target.value)} />
                <div className="model-config-hint is-wide">
                  <span>供应商参数</span>
                  <p>{providerMeta.configHint}</p>
                </div>
              </div>
              <div className="console-modal-actions">
                <button className="console-button provider-config-test-button" disabled={providerTesting} type="button" onClick={testProviderForm}>
                  <FlaskConical size={14} strokeWidth={1.9} aria-hidden="true" />
                  {providerTesting ? '测试中' : '测试连接'}
                </button>
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
          <DialogContent className="app-catalog-danger-modal" description={`确认删除 ${pendingModelDelete.name}？删除后，测试策略后续需要重新选择模型。`} footer={<><button className="console-button" type="button" onClick={() => setPendingModelDelete(null)}>取消</button><button className="console-button console-button-danger" type="button" onClick={deleteModel}><Trash2 size={14} strokeWidth={2} aria-hidden="true" />确认删除</button></>} title="删除模型确认" />
        ) : null}
      </DialogRoot>

      <DialogRoot open={Boolean(pendingProviderDelete)} onOpenChange={(open) => !open && setPendingProviderDelete(null)}>
        {pendingProviderDelete ? (
          <DialogContent className="app-catalog-danger-modal" description={`确认删除 ${pendingProviderDelete.name}？删除前请确认没有模型引用该供应商。`} footer={<><button className="console-button" type="button" onClick={() => setPendingProviderDelete(null)}>取消</button><button className="console-button console-button-danger" type="button" onClick={deleteProvider}><Trash2 size={14} strokeWidth={2} aria-hidden="true" />确认删除</button></>} title="删除供应商确认" />
        ) : null}
      </DialogRoot>
    </section>
  );
}
