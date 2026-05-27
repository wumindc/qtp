/**
 * @author codex
 * Normalizes provider-specific judge model usage into billing buckets.
 */
export interface NormalizedJudgeUsage {
  rawUsage: Record<string, unknown>;
  normalInputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  usageStatus: 'AVAILABLE' | 'NO_USAGE' | 'UNSUPPORTED';
}

export function normalizeJudgeUsage(usage: unknown): NormalizedJudgeUsage {
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

function emptyUsage(usageStatus: NormalizedJudgeUsage['usageStatus']): NormalizedJudgeUsage {
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
