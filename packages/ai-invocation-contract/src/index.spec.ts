import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createFailedModelInvocationResult,
  normalizeModelUsage,
} from './index';

describe('ai-invocation-contract', () => {
  /**
   * @author codex
   * The public invocation contract must not expose arbitrary provider wire escapes.
   */
  it('does not expose providerOptions as a generic provider wire escape hatch', () => {
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

    expect(source).not.toContain('providerOptions');
  });

  /**
   * @author codex
   * Reasoning effort is a modeled capability, not an untyped provider payload slot.
   */
  it('models reasoning effort with an explicit union instead of unknown', () => {
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

    expect(source).not.toContain('reasoningEffort?: unknown');
    expect(source).toContain("export type ReasoningEffort = 'low' | 'medium' | 'high' | 'max';");
  });

  it('normalizes cached, normal input and output token usage', () => {
    expect(normalizeModelUsage({
      input_tokens: 100,
      output_tokens: 20,
      total_tokens: 120,
      prompt_tokens_details: { cached_tokens: 40 },
    })).toMatchObject({
      normalInputTokens: 60,
      cachedInputTokens: 40,
      outputTokens: 20,
      totalTokens: 120,
      usageStatus: 'AVAILABLE',
    });
  });

  it('creates failed invocation results with elapsed time and no usage', () => {
    expect(createFailedModelInvocationResult('PROVIDER_TIMEOUT', '模型调用超时', 5000)).toEqual({
      status: 'FAILED',
      elapsedMs: 5000,
      errorCode: 'PROVIDER_TIMEOUT',
      errorMessage: '模型调用超时',
    });
  });
});
