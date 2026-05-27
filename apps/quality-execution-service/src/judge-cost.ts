import type { NormalizedJudgeUsage } from './judge-usage';

export interface ModelPricing {
  currency?: 'CNY';
  unit?: 'PER_MILLION_TOKENS';
  normalInputPrice?: number | null;
  cachedInputPrice?: number | null;
  outputPrice?: number | null;
  cacheWriteInputPrice?: number | null;
}

export interface JudgeCost {
  normalInputCostAmount: number | null;
  cachedInputCostAmount: number | null;
  outputCostAmount: number | null;
  totalCostAmount: number | null;
  currency: 'CNY';
  costStatus: 'CALCULATED' | 'NO_USAGE' | 'SKIPPED_NO_PRICE';
}

/**
 * @author codex
 * Calculates judge model cost with separate normal input, cached input, and output prices.
 */
export function calculateJudgeCost(usage: NormalizedJudgeUsage, pricing: ModelPricing | null | undefined): JudgeCost {
  const currency = pricing?.currency ?? 'CNY';
  if (usage.usageStatus !== 'AVAILABLE') {
    return emptyCost(currency, 'NO_USAGE');
  }

  const normalInputCostAmount = calculateBucketCost(usage.normalInputTokens, pricing?.normalInputPrice);
  const cachedInputCostAmount = calculateBucketCost(usage.cachedInputTokens, pricing?.cachedInputPrice);
  const outputCostAmount = calculateBucketCost(usage.outputTokens, pricing?.outputPrice);
  const hasMissingPrice =
    isMissingPrice(usage.normalInputTokens, pricing?.normalInputPrice) ||
    isMissingPrice(usage.cachedInputTokens, pricing?.cachedInputPrice) ||
    isMissingPrice(usage.outputTokens, pricing?.outputPrice);

  return {
    normalInputCostAmount,
    cachedInputCostAmount,
    outputCostAmount,
    totalCostAmount: hasMissingPrice ? null : roundAmount((normalInputCostAmount ?? 0) + (cachedInputCostAmount ?? 0) + (outputCostAmount ?? 0)),
    currency,
    costStatus: hasMissingPrice ? 'SKIPPED_NO_PRICE' : 'CALCULATED',
  };
}

function emptyCost(currency: 'CNY', costStatus: JudgeCost['costStatus']): JudgeCost {
  return {
    normalInputCostAmount: null,
    cachedInputCostAmount: null,
    outputCostAmount: null,
    totalCostAmount: null,
    currency,
    costStatus,
  };
}

function isMissingPrice(tokens: number | null, price: number | null | undefined) {
  return tokens !== null && tokens > 0 && (price === null || price === undefined);
}

function calculateBucketCost(tokens: number | null, price: number | null | undefined) {
  if (tokens === null) return null;
  if (tokens === 0) return 0;
  if (price === null || price === undefined) return null;
  return roundAmount((tokens / 1_000_000) * price);
}

function roundAmount(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
