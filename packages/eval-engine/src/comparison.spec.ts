import { describe, it, expect } from 'vitest';
import { classifyChange, aggregateComparison, runRegression, type CaseOutcome, type RunnableCase } from './index';

describe('classifyChange', () => {
  it('覆盖四种变化', () => {
    expect(classifyChange(true, false)).toBe('NEW_FAIL');
    expect(classifyChange(false, true)).toBe('FIXED');
    expect(classifyChange(false, false)).toBe('PERSIST_FAIL');
    expect(classifyChange(true, true)).toBe('STABLE_PASS');
  });
});

describe('aggregateComparison · 北极星场景', () => {
  it('3 用例中 1 个高风险新增失败 → BLOCK，通过率从 100% 跌到 66.7%', () => {
    const outcomes: CaseOutcome[] = [
      { caseId: 1, baselinePass: true, candidatePass: false, candidateFailureType: '上下文遗忘', riskLevel: 'HIGH' },
      { caseId: 2, baselinePass: true, candidatePass: true },
      { caseId: 3, baselinePass: true, candidatePass: true },
    ];
    const agg = aggregateComparison(outcomes);
    expect(agg.newFailCount).toBe(1);
    expect(agg.fixedFailCount).toBe(0);
    expect(agg.persistentFailCount).toBe(0);
    expect(agg.baselinePassRate).toBe(1);
    expect(Math.round(agg.candidatePassRate * 1000) / 1000).toBe(0.667);
    expect(agg.passRateDelta).toBeCloseTo(-1 / 3, 5);
    expect(agg.degradationByType).toEqual({ 上下文遗忘: 1 });
    expect(agg.releaseRecommendation).toBe('BLOCK'); // 高风险新增失败
  });

  it('非高风险新增失败 → REJECT', () => {
    const agg = aggregateComparison([
      { caseId: 1, baselinePass: true, candidatePass: false, candidateFailureType: '断言失败', riskLevel: 'LOW' },
    ]);
    expect(agg.releaseRecommendation).toBe('REJECT');
  });

  it('无新增失败但有持续失败导致通过率低 → 仍 PASS（无退化）', () => {
    const agg = aggregateComparison([
      { caseId: 1, baselinePass: true, candidatePass: true },
      { caseId: 2, baselinePass: false, candidatePass: false },
    ]);
    expect(agg.newFailCount).toBe(0);
    expect(agg.persistentFailCount).toBe(1);
    expect(agg.passRateDelta).toBe(0);
    expect(agg.releaseRecommendation).toBe('PASS');
  });

  it('修复失败计入 fixedFailCount', () => {
    const agg = aggregateComparison([{ caseId: 1, baselinePass: false, candidatePass: true }]);
    expect(agg.fixedFailCount).toBe(1);
    expect(agg.passRateDelta).toBe(1);
  });
});

describe('runRegression · provider 抽象', () => {
  const cases: RunnableCase[] = [
    { caseId: 1, spec: [{ turnIndex: 1, userInput: 'q', expect: { mustContain: ['对'] } }] },
    { caseId: 2, spec: [{ turnIndex: 1, userInput: 'q', expect: { mustContain: ['缺'] } }] },
  ];

  it('用桩 provider 跑回归并逐用例评估', async () => {
    const results = await runRegression(cases, (c) => [{ turnIndex: 1, answer: c.caseId === 1 ? '这是对的' : '这是错的' }]);
    expect(results).toHaveLength(2);
    expect(results[0].evaluation.passStatus).toBe('PASS');
    expect(results[1].evaluation.passStatus).toBe('FAIL');
  });

  it('支持异步 provider', async () => {
    const results = await runRegression([cases[0]], async (c) => {
      return [{ turnIndex: 1, answer: '对' }];
    });
    expect(results[0].evaluation.passStatus).toBe('PASS');
  });
});
