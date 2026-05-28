export type ProviderType = 'OPENAI_COMPATIBLE' | 'QWEN' | 'DEEPSEEK';
export type ModelType = 'LLM' | 'EMBEDDING';
export type ModelProtocol =
  | 'OPENAI_CHAT_COMPLETIONS'
  | 'OPENAI_EMBEDDINGS'
  | 'DASHSCOPE_COMPATIBLE_CHAT'
  | 'DASHSCOPE_COMPATIBLE_EMBEDDINGS'
  | 'DEEPSEEK_CHAT_COMPLETIONS';
export type StatusLabel = '启用' | '停用';

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
  pricing?: ModelPricing;
}

interface ModelPricing {
  currency?: 'CNY';
  unit?: 'PER_MILLION_TOKENS';
  normalInputPrice?: number | null;
  cachedInputPrice?: number | null;
  outputPrice?: number | null;
  cacheWriteInputPrice?: number | null;
}

export interface ModelProviderRecord {
  id: string;
  code: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
  apiKeyConfigured: boolean;
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

export interface ModelFormState {
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
  normalInputPrice: string;
  cachedInputPrice: string;
  outputPrice: string;
}

export interface ProviderFormState {
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
}
