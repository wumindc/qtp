import { describe, it, expect } from 'vitest';
import { evaluateCase, evaluateStability, type TurnSpec } from './index';

const STALE_SPEC: TurnSpec[] = [
  { turnIndex: 1, userInput: '我们公司有 80 名员工。', expect: { mustRecognize: { employee_count: 80 } } },
  { turnIndex: 2, userInput: '不对，最近调整为 20 人了。', expect: { mustUpdateContext: { employee_count: 20 }, mustNotUseStaleContext: { employee_count: 80 } } },
  { turnIndex: 3, userInput: '那我们符合小微企业认定吗？', expect: { mustNotUseStaleContext: { employee_count: 80 }, mustContain: ['20'], mustNotContain: ['80'] } },
];

describe('evaluateCase · 北极星 stale-context 场景', () => {
  it('候选第 3 轮用旧值 80 → 失败，归类上下文遗忘，stale 高亮在第 3 轮', () => {
    const actual = [
      { turnIndex: 1, answer: '好的，已记录贵公司员工人数为 80 人。' },
      { turnIndex: 2, answer: '已更新，贵公司当前员工人数为 20 人。' },
      { turnIndex: 3, answer: '按贵公司 80 名员工计算，超过小微企业从业人数上限，暂不符合。' },
    ];
    const r = evaluateCase(STALE_SPEC, actual);
    expect(r.passStatus).toBe('FAIL');
    expect(r.failureType).toBe('上下文遗忘');

    const stale = r.assertions.find((a) => a.assertionType === 'mustNotUseStaleContext' && a.turnIndex === 3)!;
    expect(stale.passed).toBe(false);
    expect(stale.evidenceSpan).not.toBeNull();

    const turn3 = r.turns.find((t) => t.turnIndex === 3)!;
    const staleHl = turn3.highlights.find((h) => h.kind === 'stale')!;
    expect(staleHl).toBeTruthy();
    expect(turn3.answer.slice(staleHl.start, staleHl.end)).toBe('80');

    // mustContain '20' 缺失也应判失败
    expect(r.assertions.find((a) => a.assertionType === 'mustContain' && a.turnIndex === 3)!.passed).toBe(false);
  });

  it('基线第 3 轮用新值 20 → 全通过，fresh 高亮在 20', () => {
    const actual = [
      { turnIndex: 1, answer: '好的，已记录贵公司员工人数为 80 人。' },
      { turnIndex: 2, answer: '已更新，贵公司当前员工人数为 20 人。' },
      { turnIndex: 3, answer: '按贵公司最新的 20 名员工计算，符合小微企业从业人数标准。' },
    ];
    const r = evaluateCase(STALE_SPEC, actual);
    expect(r.passStatus).toBe('PASS');
    expect(r.failureType).toBeNull();
    const turn3 = r.turns.find((t) => t.turnIndex === 3)!;
    const fresh = turn3.highlights.find((h) => h.kind === 'fresh')!;
    expect(turn3.answer.slice(fresh.start, fresh.end)).toBe('20');
  });
});

describe('evaluateCase · 基础断言', () => {
  it('mustContain 缺失则失败，归类断言失败', () => {
    const spec: TurnSpec[] = [{ turnIndex: 1, userInput: 'q', expect: { mustContain: ['七天', '无理由'] } }];
    const r = evaluateCase(spec, [{ turnIndex: 1, answer: '支持七天退货' }]);
    expect(r.passStatus).toBe('FAIL');
    expect(r.failureType).toBe('断言失败');
    expect(r.assertions.find((a) => a.expression.includes('无理由'))!.passed).toBe(false);
    expect(r.assertions.find((a) => a.expression.includes('七天'))!.passed).toBe(true);
  });

  it('无期望则恒通过', () => {
    const r = evaluateCase([{ turnIndex: 1, userInput: 'q' }], [{ turnIndex: 1, answer: '任意回答' }]);
    expect(r.passStatus).toBe('PASS');
    expect(r.assertions).toHaveLength(0);
  });
});

describe('evaluateStability · 真退化 vs 抖动', () => {
  it('5 次有 4 次失败且基线通过 → 真退化', () => {
    const r = evaluateStability([false, false, false, false, true], true);
    expect(r.regressionVerdict).toBe('TRUE_REGRESSION');
    expect(r.stabilityScore).toBe(0.8);
    expect(r.regressionConfidence).toBe(0.8);
  });

  it('5 次仅 2 次失败（多数通过）→ 疑似抖动', () => {
    const r = evaluateStability([false, false, true, true, true], true);
    expect(r.regressionVerdict).toBe('SUSPECTED_FLAKE');
  });

  it('全部通过 → 无退化', () => {
    const r = evaluateStability([true, true, true], true);
    expect(r.regressionVerdict).toBeNull();
    expect(r.stabilityScore).toBe(1);
  });

  it('空采样 → 全 null', () => {
    const r = evaluateStability([], true);
    expect(r.sampleCount).toBe(0);
    expect(r.stabilityScore).toBeNull();
  });
});
