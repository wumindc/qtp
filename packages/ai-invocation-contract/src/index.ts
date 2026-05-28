/**
 * @author codex
 * Stable internal AI invocation contracts shared by clients and provider adapters.
 */
export type ModelProtocol = 'OPENAI_COMPATIBLE' | 'QWEN_COMPATIBLE' | 'DASHSCOPE_COMPATIBLE_CHAT';
export type EmbeddingModelProtocol = 'OPENAI_EMBEDDINGS' | 'DASHSCOPE_COMPATIBLE_EMBEDDINGS';
export type ProviderInvocationKind = 'OPENAI_COMPATIBLE' | 'QWEN' | 'DEEPSEEK';
export type ReasoningEffort = 'low' | 'medium' | 'high' | 'max';

export interface ModelInvocationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelInvocationRequest {
  traceId: string;
  providerCode: string;
  providerKind?: ProviderInvocationKind;
  modelId: string;
  protocol: ModelProtocol;
  messages: ModelInvocationMessage[];
  temperature?: number;
  responseFormat?: 'json_object' | 'text';
  stream?: boolean;
  enableThinking?: boolean;
  timeoutMs?: number;
  maxTokens?: number;
  topP?: number;
  reasoningEffort?: ReasoningEffort;
}

export interface NormalizedModelUsage {
  rawUsage: Record<string, unknown>;
  normalInputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  usageStatus: 'AVAILABLE' | 'NO_USAGE' | 'UNSUPPORTED';
}

export interface ModelInvocationResult {
  status: 'SUCCEEDED' | 'FAILED';
  content?: string;
  responseJson?: Record<string, unknown>;
  rawResponseText?: string;
  usage?: NormalizedModelUsage;
  elapsedMs: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface EmbeddingInvocationRequest {
  traceId: string;
  providerCode: string;
  modelId: string;
  protocol: EmbeddingModelProtocol;
  input: string | string[];
  timeoutMs?: number;
  dimensions?: number;
  encodingFormat?: 'float' | 'base64';
}

export interface ModelDiscoveryRequest {
  traceId: string;
  providerCode: string;
  timeoutMs?: number;
}

export interface EmbeddingInvocationResult {
  status: 'SUCCEEDED' | 'FAILED';
  responseJson?: Record<string, unknown>;
  rawResponseText?: string;
  elapsedMs: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface ModelDiscoveryResult {
  status: 'SUCCEEDED' | 'FAILED';
  responseJson?: Record<string, unknown>;
  rawResponseText?: string;
  elapsedMs: number;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * @author codex
 * Normalizes provider-specific token usage into the platform billing buckets.
 */
export function normalizeModelUsage(usage: unknown): NormalizedModelUsage {
  const rawUsage = asRecord(usage);
  if (Object.keys(rawUsage).length === 0) {
    return emptyUsage('NO_USAGE');
  }

  const promptDetails = asRecord(rawUsage.prompt_tokens_details);
  const directCachedTokens = readNumber(promptDetails.cached_tokens);
  const anthropicCachedTokens = readNumber(rawUsage.cache_read_input_tokens);
  const cachedInputTokens = directCachedTokens ?? anthropicCachedTokens ?? 0;
  const inputTokens = readNumber(rawUsage.input_tokens) ?? readNumber(rawUsage.prompt_tokens);
  const outputTokens = readNumber(rawUsage.output_tokens) ?? readNumber(rawUsage.completion_tokens);
  const totalTokens = readNumber(rawUsage.total_tokens) ?? sumKnown(inputTokens, outputTokens, cachedInputTokens);

  if (inputTokens === null && outputTokens === null && totalTokens === null) {
    return { ...emptyUsage('UNSUPPORTED'), rawUsage };
  }

  const cachedIncludedInInput = directCachedTokens !== null;
  const normalInputTokens = inputTokens === null
    ? null
    : Math.max(0, inputTokens - (cachedIncludedInInput ? cachedInputTokens : 0));

  return {
    rawUsage,
    normalInputTokens,
    cachedInputTokens,
    outputTokens,
    totalTokens,
    usageStatus: 'AVAILABLE',
  };
}

/**
 * @author codex
 * Builds a normalized chat invocation failure result.
 */
export function createFailedModelInvocationResult(
  errorCode: string,
  errorMessage: string,
  elapsedMs: number,
): ModelInvocationResult {
  return {
    status: 'FAILED',
    elapsedMs,
    errorCode,
    errorMessage,
  };
}

/**
 * @author codex
 * Builds a normalized embedding invocation failure result.
 */
export function createFailedEmbeddingInvocationResult(
  errorCode: string,
  errorMessage: string,
  elapsedMs: number,
): EmbeddingInvocationResult {
  return {
    status: 'FAILED',
    elapsedMs,
    errorCode,
    errorMessage,
  };
}

/**
 * @author codex
 * Builds a normalized model discovery failure result.
 */
export function createFailedModelDiscoveryResult(
  errorCode: string,
  errorMessage: string,
  elapsedMs: number,
): ModelDiscoveryResult {
  return {
    status: 'FAILED',
    elapsedMs,
    errorCode,
    errorMessage,
  };
}

function emptyUsage(usageStatus: NormalizedModelUsage['usageStatus']): NormalizedModelUsage {
  return {
    rawUsage: {},
    normalInputTokens: null,
    cachedInputTokens: null,
    outputTokens: null,
    totalTokens: null,
    usageStatus,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readNumber(value: unknown): number | null {
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(numberValue)) return null;
  return Math.max(0, Math.round(numberValue));
}

function sumKnown(...values: Array<number | null>) {
  const known = values.filter((value): value is number => value !== null);
  return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0);
}
