import { describe, expect, it } from 'vitest';
import { normalizeJudgeUsage } from './judge-usage';

describe('normalizeJudgeUsage', () => {
  it('splits Qwen cached prompt tokens from normal input tokens', () => {
    expect(normalizeJudgeUsage({
      input_tokens: 1000,
      output_tokens: 120,
      total_tokens: 1120,
      prompt_tokens_details: {
        cached_tokens: 300,
      },
    })).toMatchObject({
      normalInputTokens: 700,
      cachedInputTokens: 300,
      outputTokens: 120,
      totalTokens: 1120,
      usageStatus: 'AVAILABLE',
    });
  });

  it('normalizes OpenAI-compatible prompt and completion tokens', () => {
    expect(normalizeJudgeUsage({
      prompt_tokens: 42,
      completion_tokens: 18,
      total_tokens: 60,
    })).toMatchObject({
      normalInputTokens: 42,
      cachedInputTokens: 0,
      outputTokens: 18,
      totalTokens: 60,
      usageStatus: 'AVAILABLE',
    });
  });

  it('reports missing usage without estimating tokens', () => {
    expect(normalizeJudgeUsage(undefined)).toMatchObject({
      normalInputTokens: null,
      cachedInputTokens: null,
      outputTokens: null,
      totalTokens: null,
      usageStatus: 'NO_USAGE',
    });
  });
});
