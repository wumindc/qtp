import type { ModelFormState, ModelProtocol, ModelProviderRecord, ModelType, ProviderFormState, ProviderType, StatusLabel } from './types';

export const PROVIDER_TYPE_META: Record<ProviderType, { label: string; defaultBaseUrl: string; llmExample: string; embeddingExample?: string; configHint: string }> = {
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

export const MODEL_TYPE_META: Record<ModelType, { label: string; description: string }> = {
  LLM: { label: 'LLM', description: '对话、评估、工具调用和结构化输出' },
  EMBEDDING: { label: 'Embedding', description: '向量化、相似度、召回和检索' },
};

export const PROTOCOL_META: Record<ModelProtocol, string> = {
  OPENAI_CHAT_COMPLETIONS: 'OpenAI Chat Completions',
  OPENAI_EMBEDDINGS: 'OpenAI Embeddings',
  DASHSCOPE_COMPATIBLE_CHAT: '百炼兼容 Chat',
  DASHSCOPE_COMPATIBLE_EMBEDDINGS: '百炼兼容 Embeddings',
  DEEPSEEK_CHAT_COMPLETIONS: 'DeepSeek Chat Completions',
};

export const SUPPORT_OPTIONS = [
  { label: '支持', value: 'true' },
  { label: '不支持', value: 'false' },
];

export function buildModelForm(providerCode = '', providerType: ProviderType = 'OPENAI_COMPATIBLE', modelType: ModelType = 'LLM'): ModelFormState {
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

export function buildProviderForm(type: ProviderType = 'OPENAI_COMPATIBLE'): ProviderFormState {
  return {
    name: '',
    type,
    baseUrl: '',
    apiKey: '',
  };
}

export function toStatusLabel(enabled: boolean): StatusLabel {
  return enabled ? '启用' : '停用';
}

export function parseTokenCount(value: string, fallback?: number) {
  const normalized = value.trim().replace(/,/g, '').replace(/\s+/g, '').toLowerCase();
  if (!normalized) return fallback;
  const match = normalized.match(/^(\d+(?:\.\d+)?)([km])?$/);
  if (!match) return fallback;
  const unit = match[2];
  const multiplier = unit === 'm' ? 1_000_000 : unit === 'k' ? 1_000 : 1;
  const parsed = Number(match[1]) * multiplier;
  return Number.isFinite(parsed) && parsed > 0 && Number.isInteger(parsed) ? parsed : fallback;
}

export function formatTokenDisplay(value?: number) {
  if (!value) return '-';
  if (value % 1_000_000 === 0) return `${value / 1_000_000}M`;
  if (value % 1_000 === 0) return `${value / 1_000}K`;
  return value.toLocaleString();
}

export function providerToOptionLabel(provider: ModelProviderRecord) {
  return `${provider.name} (${PROVIDER_TYPE_META[provider.type].label})`;
}

export function resolveProtocol(providerType: ProviderType, modelType: ModelType): ModelProtocol {
  if (providerType === 'QWEN') return modelType === 'EMBEDDING' ? 'DASHSCOPE_COMPATIBLE_EMBEDDINGS' : 'DASHSCOPE_COMPATIBLE_CHAT';
  if (providerType === 'DEEPSEEK') return 'DEEPSEEK_CHAT_COMPLETIONS';
  return modelType === 'EMBEDDING' ? 'OPENAI_EMBEDDINGS' : 'OPENAI_CHAT_COMPLETIONS';
}

function toNumber(value: string, fallback?: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : fallback;
}

function toBoolean(value: string) {
  return value === 'true';
}

/**
 * @author codex
 * Builds the backend model payload from the POC form without exposing internal model codes.
 */
export function buildModelPayload(modelForm: ModelFormState, provider: ModelProviderRecord) {
  const modelType = modelForm.modelType;
  const parameters =
    modelType === 'EMBEDDING'
      ? { dimensions: toNumber(modelForm.dimensions) }
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
      ? { embeddingDimensions: toNumber(modelForm.dimensions), maxInputTokens: 8192 }
      : {
          contextWindow: parseTokenCount(modelForm.contextWindow, 128000),
          maxOutputTokens: parseTokenCount(modelForm.maxOutputTokens, 4096),
        };
  return {
    modelName: modelForm.name.trim(),
    providerCode: modelForm.provider,
    modelId: modelForm.modelId.trim(),
    modelType,
    protocol: resolveProtocol(provider.type, modelType),
    parameters,
    capabilities,
    limits,
  };
}
