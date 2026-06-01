/**
 * @author qtp
 * 随机性下的回归判定（Stage 2 核心）。
 * LLM 输出是概率性的——「候选失败」可能是真退化，也可能是采样抖动。
 * 给定同一用例多次采样的通过/失败序列，区分两者并给出置信度。
 */

export type RegressionVerdict = 'TRUE_REGRESSION' | 'SUSPECTED_FLAKE';

export interface StabilityResult {
  sampleCount: number;
  /** 一致性：多次采样中多数结论的占比，1.0 = 完全稳定 */
  stabilityScore: number | null;
  regressionVerdict: RegressionVerdict | null;
  /** 该判定的置信度 0-1 */
  regressionConfidence: number | null;
}

/** 一致性达到该阈值才认为「稳定」，否则倾向判为抖动。 */
export const FLAKE_THRESHOLD = 0.6;

/**
 * @param samplePassed 每次采样是否通过（true=通过）
 * @param baselinePassed 基线版本在该用例上是否通过（用于区分新增退化 vs 历史失败）
 */
export function evaluateStability(samplePassed: boolean[], baselinePassed: boolean): StabilityResult {
  const n = samplePassed.length;
  if (n === 0) {
    return { sampleCount: 0, stabilityScore: null, regressionVerdict: null, regressionConfidence: null };
  }
  const failCount = samplePassed.filter((p) => !p).length;
  const passCount = n - failCount;
  const majorityFail = failCount > passCount;
  const agreement = Math.max(failCount, passCount) / n; // 一致性

  // 全部通过：无退化
  if (failCount === 0) {
    return { sampleCount: n, stabilityScore: 1, regressionVerdict: null, regressionConfidence: null };
  }

  // 多数失败且足够一致 → 真退化；否则（不一致/偶发）→ 疑似抖动
  if (majorityFail && agreement >= FLAKE_THRESHOLD) {
    return {
      sampleCount: n,
      stabilityScore: round(agreement),
      regressionVerdict: 'TRUE_REGRESSION',
      // 基线原本通过 → 更确信是本次引入的退化
      regressionConfidence: round(baselinePassed ? agreement : agreement * 0.85),
    };
  }

  return {
    sampleCount: n,
    stabilityScore: round(agreement),
    regressionVerdict: 'SUSPECTED_FLAKE',
    regressionConfidence: round(failCount / n),
  };
}

function round(x: number): number {
  return Math.round(x * 100) / 100;
}
