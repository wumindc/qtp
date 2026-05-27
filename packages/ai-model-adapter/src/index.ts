/**
 * @author codex
 * Shared model invocation contracts and provider-compatible payload helpers.
 */
export type ModelProtocol = 'OPENAI_COMPATIBLE' | 'QWEN_COMPATIBLE' | 'DASHSCOPE_COMPATIBLE_CHAT';

export interface ModelInvocationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelInvocationRequest {
  traceId: string;
  providerCode: string;
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
  reasoningEffort?: unknown;
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
  if (request.enableThinking !== undefined) body.enable_thinking = request.enableThinking;
  if (request.reasoningEffort) body.reasoning_effort = request.reasoningEffort;
  return body;
}

/**
 * @author codex
 * Normalizes provider-specific token usage into billing buckets.
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
 * Builds a normalized failure result for callers that need a stable adapter shape.
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

function buildChatCompletionsUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/u, '')}/chat/completions`;
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

function readNumber(value: unknown): number | null {
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(numberValue)) return null;
  return Math.max(0, Math.round(numberValue));
}

function sumKnown(...values: Array<number | null>) {
  const known = values.filter((value): value is number => value !== null);
  return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0);
}
