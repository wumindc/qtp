/**
 * @author qtp
 * 回归对比聚合：把「基线 run × 候选 run」的逐用例结果聚合为
 * 新增/修复/持续失败、通过率变化、退化分布与发布建议。
 * 纯函数、可测，供执行编排与 seed 共用（消除手写聚合逻辑）。
 */

export type ResultChange = 'NEW_FAIL' | 'FIXED' | 'PERSIST_FAIL' | 'STABLE_PASS';
export type ReleaseRecommendation = 'PASS' | 'WATCH' | 'MANUAL' | 'REJECT' | 'BLOCK';

export interface CaseOutcome {
  caseId: number;
  baselinePass: boolean;
  candidatePass: boolean;
  /** 候选失败时的失败类型（用于退化分布） */
  candidateFailureType?: string | null;
  /** 候选用例风险等级，用于发布建议升级 */
  riskLevel?: string;
}

export interface ComparisonAggregate {
  total: number;
  newFailCount: number;
  fixedFailCount: number;
  persistentFailCount: number;
  stablePassCount: number;
  baselinePassRate: number;
  candidatePassRate: number;
  passRateDelta: number;
  degradationByType: Record<string, number>;
  releaseRecommendation: ReleaseRecommendation;
}

export function classifyChange(baselinePass: boolean, candidatePass: boolean): ResultChange {
  if (baselinePass && !candidatePass) return 'NEW_FAIL';
  if (!baselinePass && candidatePass) return 'FIXED';
  if (!baselinePass && !candidatePass) return 'PERSIST_FAIL';
  return 'STABLE_PASS';
}

/**
 * 发布建议规则（可演进）：
 *  - 有高风险新增失败 → BLOCK（阻断）
 *  - 有新增失败 → REJECT（不建议发布）
 *  - 无新增失败但通过率下降 → WATCH（需关注）
 *  - 否则 → PASS（可发布）
 */
function recommend(newFail: number, highRiskNewFail: number, passRateDelta: number): ReleaseRecommendation {
  if (highRiskNewFail > 0) return 'BLOCK';
  if (newFail > 0) return 'REJECT';
  if (passRateDelta < 0) return 'WATCH';
  return 'PASS';
}

export function aggregateComparison(outcomes: CaseOutcome[]): ComparisonAggregate {
  const total = outcomes.length;
  let newFailCount = 0;
  let fixedFailCount = 0;
  let persistentFailCount = 0;
  let stablePassCount = 0;
  let highRiskNewFail = 0;
  let basePass = 0;
  let candPass = 0;
  const degradationByType: Record<string, number> = {};

  for (const o of outcomes) {
    if (o.baselinePass) basePass++;
    if (o.candidatePass) candPass++;
    switch (classifyChange(o.baselinePass, o.candidatePass)) {
      case 'NEW_FAIL': {
        newFailCount++;
        if ((o.riskLevel ?? '').toUpperCase() === 'HIGH') highRiskNewFail++;
        const t = o.candidateFailureType ?? '其他';
        degradationByType[t] = (degradationByType[t] ?? 0) + 1;
        break;
      }
      case 'FIXED':
        fixedFailCount++;
        break;
      case 'PERSIST_FAIL':
        persistentFailCount++;
        break;
      case 'STABLE_PASS':
        stablePassCount++;
        break;
    }
  }

  const baselinePassRate = total ? basePass / total : 0;
  const candidatePassRate = total ? candPass / total : 0;
  const passRateDelta = candidatePassRate - baselinePassRate;

  return {
    total,
    newFailCount,
    fixedFailCount,
    persistentFailCount,
    stablePassCount,
    baselinePassRate,
    candidatePassRate,
    passRateDelta,
    degradationByType,
    releaseRecommendation: recommend(newFailCount, highRiskNewFail, passRateDelta),
  };
}
