import { normalizeInvocationUsage, type NormalizedModelUsage } from '@ai-quality-platform/ai-invocation-client';

/**
 * @author codex
 * Keeps the execution service billing API stable while delegating normalization to the shared model adapter.
 */
export type NormalizedJudgeUsage = NormalizedModelUsage;

/**
 * @author codex
 * Normalizes provider-specific judge model usage into billing buckets.
 */
export const normalizeJudgeUsage = normalizeInvocationUsage;
