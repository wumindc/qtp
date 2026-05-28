/**
 * @author codex
 * Provider-compatible payload helpers for the internal AI invocation boundary.
 */
import {
  createFailedEmbeddingInvocationResult,
  createFailedModelDiscoveryResult,
  createFailedModelInvocationResult,
  normalizeModelUsage,
  type EmbeddingInvocationRequest,
  type EmbeddingInvocationResult,
  type ModelDiscoveryRequest,
  type ModelDiscoveryResult,
  type ModelInvocationRequest,
  type ModelInvocationResult,
  type NormalizedModelUsage,
} from '@ai-quality-platform/ai-invocation-contract';

export {
  createFailedEmbeddingInvocationResult,
  createFailedModelDiscoveryResult,
  createFailedModelInvocationResult,
  normalizeModelUsage,
} from '@ai-quality-platform/ai-invocation-contract';

export type {
  EmbeddingInvocationRequest,
  EmbeddingInvocationResult,
  EmbeddingModelProtocol,
  ModelDiscoveryRequest,
  ModelDiscoveryResult,
  ModelInvocationMessage,
  ModelInvocationRequest,
  ModelInvocationResult,
  ModelProtocol,
  NormalizedModelUsage,
  ProviderInvocationKind,
} from '@ai-quality-platform/ai-invocation-contract';

export interface ModelTokenPricing {
  currency?: string;
  unit?: 'PER_MILLION_TOKENS';
  normalInputPrice?: number | null;
  cachedInputPrice?: number | null;
  outputPrice?: number | null;
}

export interface ModelCostResult {
  currency: string;
  normalInputCostAmount: number | null;
  cachedInputCostAmount: number | null;
  outputCostAmount: number | null;
  totalCostAmount: number | null;
  costStatus: 'CALCULATED' | 'NO_USAGE' | 'SKIPPED_NO_PRICE';
}

export interface ProviderAdapter {
  testConnection(): Promise<ModelInvocationResult>;
  invoke(request: ModelInvocationRequest): Promise<ModelInvocationResult>;
}

export interface ChatCompletionsProviderAdapterOptions {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export interface EmbeddingsProviderAdapterOptions {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export interface ModelDiscoveryProviderAdapterOptions {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

/**
 * @author codex
 * Builds an OpenAI-compatible chat completions payload with provider extensions kept explicit.
 */
export function buildChatCompletionsPayload(request: ModelInvocationRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.modelId,
    messages: request.messages,
    stream: request.stream ?? false,
  };
  if (typeof request.temperature === 'number') body.temperature = request.temperature;
  if (typeof request.maxTokens === 'number') body.max_tokens = request.maxTokens;
  if (request.responseFormat === 'json_object') body.response_format = { type: 'json_object' };
  if (typeof request.topP === 'number') body.top_p = request.topP;
  if (request.enableThinking !== undefined) {
    if (request.providerKind === 'DEEPSEEK') body.thinking = { type: request.enableThinking ? 'enabled' : 'disabled' };
    else body.enable_thinking = request.enableThinking;
  }
  if (isReasoningEffort(request.reasoningEffort)) body.reasoning_effort = request.reasoningEffort;
  return body;
}

/**
 * @author codex
 * Builds an OpenAI-compatible embeddings payload.
 */
export function buildEmbeddingsPayload(request: EmbeddingInvocationRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.modelId,
    input: request.input,
  };
  if (typeof request.dimensions === 'number') body.dimensions = request.dimensions;
  if (request.encodingFormat) body.encoding_format = request.encodingFormat;
  return body;
}

/**
 * @author codex
 * Creates a provider adapter for OpenAI-compatible chat completions endpoints.
 */
export function createChatCompletionsProviderAdapter(options: ChatCompletionsProviderAdapterOptions): ProviderAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async testConnection() {
      return createFailedModelInvocationResult('PROVIDER_TEST_NOT_CONFIGURED', '请通过具体模型调用测试连接', 0);
    },
    async invoke(request) {
      const startedAt = Date.now();
      const controller = new AbortController();
      const timeout = request.timeoutMs
        ? setTimeout(() => controller.abort(), request.timeoutMs)
        : undefined;
      try {
        const response = await fetchImpl(buildChatCompletionsUrl(options.baseUrl), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildChatCompletionsPayload(request)),
          signal: controller.signal,
        });
        const rawResponseText = await response.text();
        if (!response.ok) {
          return createFailedModelInvocationResult(
            classifyHttpProviderError(response.status),
            `模型供应商返回 HTTP ${response.status}`,
            Date.now() - startedAt,
          );
        }
        const responseJson = parseJson(rawResponseText);
        const content = extractChatContent(responseJson);
        return {
          status: 'SUCCEEDED',
          content,
          responseJson,
          rawResponseText,
          usage: normalizeModelUsage(responseJson.usage),
          elapsedMs: Date.now() - startedAt,
        };
      } catch (error) {
        return createFailedModelInvocationResult(
          classifyThrownProviderError(error),
          describeProviderError(error),
          Date.now() - startedAt,
        );
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    },
  };
}

/**
 * @author codex
 * Creates a provider adapter for OpenAI-compatible embeddings endpoints.
 */
export function createEmbeddingsProviderAdapter(options: EmbeddingsProviderAdapterOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async invoke(request: EmbeddingInvocationRequest): Promise<EmbeddingInvocationResult> {
      const startedAt = Date.now();
      const controller = new AbortController();
      const timeout = request.timeoutMs
        ? setTimeout(() => controller.abort(), request.timeoutMs)
        : undefined;
      try {
        const response = await fetchImpl(buildEmbeddingsUrl(options.baseUrl), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildEmbeddingsPayload(request)),
          signal: controller.signal,
        });
        const rawResponseText = await response.text();
        if (!response.ok) {
          return createFailedEmbeddingInvocationResult(
            classifyHttpProviderError(response.status),
            `模型供应商返回 HTTP ${response.status}`,
            Date.now() - startedAt,
          );
        }
        const responseJson = parseJson(rawResponseText);
        return {
          status: 'SUCCEEDED',
          responseJson,
          rawResponseText,
          elapsedMs: Date.now() - startedAt,
        };
      } catch (error) {
        return createFailedEmbeddingInvocationResult(
          classifyThrownProviderError(error),
          describeProviderError(error),
          Date.now() - startedAt,
        );
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    },
  };
}

/**
 * @author codex
 * Creates a provider adapter for OpenAI-compatible model discovery endpoints.
 */
export function createModelDiscoveryProviderAdapter(options: ModelDiscoveryProviderAdapterOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async listModels(request: ModelDiscoveryRequest): Promise<ModelDiscoveryResult> {
      const startedAt = Date.now();
      const controller = new AbortController();
      const timeout = request.timeoutMs
        ? setTimeout(() => controller.abort(), request.timeoutMs)
        : undefined;
      try {
        const response = await fetchImpl(buildModelsUrl(options.baseUrl), {
          method: 'GET',
          headers: { Authorization: `Bearer ${options.apiKey}` },
          signal: controller.signal,
        });
        const rawResponseText = await response.text();
        if (!response.ok) {
          return createFailedModelDiscoveryResult(
            classifyHttpProviderError(response.status),
            `模型供应商返回 HTTP ${response.status}`,
            Date.now() - startedAt,
          );
        }
        return {
          status: 'SUCCEEDED',
          responseJson: parseJson(rawResponseText),
          rawResponseText,
          elapsedMs: Date.now() - startedAt,
        };
      } catch (error) {
        return createFailedModelDiscoveryResult(
          classifyThrownProviderError(error),
          describeProviderError(error),
          Date.now() - startedAt,
        );
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    },
  };
}

/**
 * @author codex
 * Calculates token cost with the shared million-token pricing convention.
 */
export function calculateModelTokenCost(
  usage: NormalizedModelUsage,
  pricing?: ModelTokenPricing,
): ModelCostResult {
  const currency = pricing?.currency ?? 'CNY';
  if (usage.usageStatus !== 'AVAILABLE') {
    return emptyCost(currency, 'NO_USAGE');
  }
  if (!pricing || pricing.unit !== 'PER_MILLION_TOKENS') {
    return emptyCost(currency, 'SKIPPED_NO_PRICE');
  }
  const normalInputCostAmount = multiplyPerMillion(usage.normalInputTokens, pricing.normalInputPrice);
  const cachedInputCostAmount = multiplyPerMillion(usage.cachedInputTokens, pricing.cachedInputPrice);
  const outputCostAmount = multiplyPerMillion(usage.outputTokens, pricing.outputPrice);
  const amounts = [normalInputCostAmount, cachedInputCostAmount, outputCostAmount];
  if (amounts.some((amount) => amount === null)) {
    return {
      currency,
      normalInputCostAmount,
      cachedInputCostAmount,
      outputCostAmount,
      totalCostAmount: null,
      costStatus: 'SKIPPED_NO_PRICE',
    };
  }
  const calculatedAmounts = amounts as number[];
  return {
    currency,
    normalInputCostAmount,
    cachedInputCostAmount,
    outputCostAmount,
    totalCostAmount: roundAmount(calculatedAmounts.reduce((sum, amount) => sum + amount, 0)),
    costStatus: 'CALCULATED',
  };
}

function buildChatCompletionsUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/u, '')}/chat/completions`;
}

function buildEmbeddingsUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/u, '')}/embeddings`;
}

function buildModelsUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/u, '')}/models`;
}

function parseJson(rawResponseText: string): Record<string, unknown> {
  try {
    return JSON.parse(rawResponseText) as Record<string, unknown>;
  } catch {
    throw new Error('模型供应商返回了非法 JSON');
  }
}

function extractChatContent(responseJson: Record<string, unknown>): string {
  const content =
    readPath(responseJson, ['choices', 0, 'message', 'content']) ??
    readPath(responseJson, ['choices', 0, 'delta', 'content']) ??
    readPath(responseJson, ['output', 'text']) ??
    responseJson.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('模型供应商未返回有效内容');
  }
  return content;
}

function readPath(source: unknown, path: Array<string | number>): unknown {
  let current = source;
  for (const segment of path) {
    if (typeof segment === 'number') {
      current = Array.isArray(current) ? current[segment] : undefined;
    } else {
      current = asRecord(current)[segment];
    }
  }
  return current;
}

function classifyHttpProviderError(status: number) {
  if (status === 401 || status === 403) return 'PROVIDER_AUTH_FAILED';
  if (status === 408 || status === 504) return 'PROVIDER_TIMEOUT';
  if (status === 429) return 'PROVIDER_RATE_LIMITED';
  if (status >= 500) return 'PROVIDER_UPSTREAM_ERROR';
  return 'PROVIDER_BAD_RESPONSE';
}

function classifyThrownProviderError(error: unknown) {
  if (isAbortError(error)) return 'PROVIDER_TIMEOUT';
  if (error instanceof Error && error.message.includes('非法 JSON')) return 'PROVIDER_BAD_RESPONSE';
  if (error instanceof Error && error.message.includes('有效内容')) return 'PROVIDER_BAD_RESPONSE';
  return 'PROVIDER_NETWORK_ERROR';
}

function describeProviderError(error: unknown) {
  if (isAbortError(error)) return '模型供应商调用超时';
  return error instanceof Error ? error.message : '模型供应商调用失败';
}

function isAbortError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const data = error as { name?: unknown; message?: unknown };
  return data.name === 'AbortError' || (typeof data.message === 'string' && data.message.toLowerCase().includes('aborted'));
}

function emptyCost(currency: string, costStatus: ModelCostResult['costStatus']): ModelCostResult {
  return {
    currency,
    normalInputCostAmount: null,
    cachedInputCostAmount: null,
    outputCostAmount: null,
    totalCostAmount: null,
    costStatus,
  };
}

function multiplyPerMillion(tokens: number | null, price: number | null | undefined) {
  if (tokens === null) return 0;
  if (price === null || price === undefined) return null;
  return roundAmount((tokens / 1_000_000) * price);
}

function roundAmount(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isReasoningEffort(value: unknown): value is ModelInvocationRequest['reasoningEffort'] {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'max';
}
