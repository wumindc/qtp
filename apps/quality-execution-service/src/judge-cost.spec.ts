import { describe, expect, it } from 'vitest';
import { calculateJudgeCost } from './judge-cost';

describe('calculateJudgeCost', () => {
  it('calculates normal input, cached input, and output cost independently', () => {
    expect(calculateJudgeCost({
      normalInputTokens: 1_000_000,
      cachedInputTokens: 500_000,
      outputTokens: 250_000,
      totalTokens: 1_750_000,
      usageStatus: 'AVAILABLE',
      rawUsage: {},
    }, {
      currency: 'CNY',
      unit: 'PER_MILLION_TOKENS',
      normalInputPrice: 1,
      cachedInputPrice: 0.2,
      outputPrice: 4,
    })).toMatchObject({
      normalInputCostAmount: 1,
      cachedInputCostAmount: 0.1,
      outputCostAmount: 1,
      totalCostAmount: 2.1,
      currency: 'CNY',
      costStatus: 'CALCULATED',
    });
  });

  it('keeps token usage but skips amount when a required price is missing', () => {
    expect(calculateJudgeCost({
      normalInputTokens: 1000,
      cachedInputTokens: 1000,
      outputTokens: 1000,
      totalTokens: 3000,
      usageStatus: 'AVAILABLE',
      rawUsage: {},
    }, {
      currency: 'CNY',
      unit: 'PER_MILLION_TOKENS',
      normalInputPrice: 1,
      cachedInputPrice: null,
      outputPrice: 4,
    })).toMatchObject({
      normalInputCostAmount: 0.001,
      cachedInputCostAmount: null,
      outputCostAmount: 0.004,
      totalCostAmount: null,
      costStatus: 'SKIPPED_NO_PRICE',
    });
  });

  it('does not calculate cost when usage is missing', () => {
    expect(calculateJudgeCost({
      normalInputTokens: null,
      cachedInputTokens: null,
      outputTokens: null,
      totalTokens: null,
      usageStatus: 'NO_USAGE',
      rawUsage: {},
    }, {
      currency: 'CNY',
      unit: 'PER_MILLION_TOKENS',
      normalInputPrice: 1,
      cachedInputPrice: 0.2,
      outputPrice: 4,
    })).toMatchObject({
      normalInputCostAmount: null,
      cachedInputCostAmount: null,
      outputCostAmount: null,
      totalCostAmount: null,
      costStatus: 'NO_USAGE',
    });
  });
});
