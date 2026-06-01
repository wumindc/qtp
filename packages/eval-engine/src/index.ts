/**
 * @author qtp
 * 多轮上下文断言引擎（确定性、零依赖）。
 * 给定用例多轮脚本（期望）与实际逐轮回答，计算：
 *   - 逐断言通过/失败 + 证据 span
 *   - 逐轮高亮（stale=违规旧值红 / fresh=命中要点绿）
 *   - 失败类型与整体通过状态
 * 这是 QTP 的差异化核心（Stage 3）：把 PASS/FAIL 变成「第几轮、为什么」。
 */

export type AssertionType =
  | 'mustContain'
  | 'mustNotContain'
  | 'mustUpdateContext'
  | 'mustNotUseStaleContext'
  | 'mustRecognize';

export interface TurnExpect {
  mustContain?: string[];
  mustNotContain?: string[];
  mustUpdateContext?: Record<string, string | number>;
  mustNotUseStaleContext?: Record<string, string | number>;
  mustRecognize?: Record<string, string | number>;
}

export interface TurnSpec {
  turnIndex: number;
  userInput: string;
  expect?: TurnExpect;
}

export interface TurnActual {
  turnIndex: number;
  userInput?: string;
  answer: string;
  latencyMs?: number;
  status?: string;
}

export interface Highlight {
  start: number;
  end: number;
  kind: 'stale' | 'fresh';
}

export interface EvaluatedAssertion {
  turnIndex: number;
  assertionType: AssertionType;
  expression: string;
  expectedValue: unknown;
  actualValue: unknown;
  passed: boolean;
  evidenceSpan: { turnIndex: number; start: number; end: number } | null;
}

export interface EvaluatedTurn {
  turnIndex: number;
  userInput: string;
  answer: string;
  latencyMs?: number;
  status?: string;
  highlights: Highlight[];
}

export interface CaseEvaluation {
  passStatus: 'PASS' | 'FAIL';
  failureType: string | null;
  assertions: EvaluatedAssertion[];
  turns: EvaluatedTurn[];
}

const CONTEXT_TYPES: AssertionType[] = ['mustUpdateContext', 'mustNotUseStaleContext'];

function findSpan(haystack: string, needle: string): { start: number; end: number } | null {
  const start = haystack.indexOf(needle);
  if (start < 0) return null;
  return { start, end: start + needle.length };
}

function pushHighlight(list: Highlight[], span: { start: number; end: number } | null, kind: Highlight['kind']) {
  if (!span) return;
  if (list.some((h) => h.start === span.start && h.end === span.end)) return;
  list.push({ start: span.start, end: span.end, kind });
}

/**
 * 评估单个多轮用例。spec 与 actual 以 turnIndex 对齐。
 */
export function evaluateCase(spec: TurnSpec[], actual: TurnActual[]): CaseEvaluation {
  const specByTurn = new Map(spec.map((t) => [t.turnIndex, t]));
  const assertions: EvaluatedAssertion[] = [];
  const turns: EvaluatedTurn[] = [];
  const failedTypes = new Set<AssertionType>();

  for (const a of actual) {
    const highlights: Highlight[] = [];
    const expect = specByTurn.get(a.turnIndex)?.expect;
    const answer = a.answer ?? '';

    if (expect) {
      for (const token of expect.mustContain ?? []) {
        const span = findSpan(answer, token);
        const passed = span != null;
        if (passed) pushHighlight(highlights, span, 'fresh');
        else failedTypes.add('mustContain');
        assertions.push(mkAssertion('mustContain', a.turnIndex, `answer contains "${token}"`, [token], passed ? '已包含' : '未包含', passed, null));
      }
      for (const token of expect.mustNotContain ?? []) {
        const span = findSpan(answer, token);
        const passed = span == null;
        if (!passed) {
          pushHighlight(highlights, span, 'stale');
          failedTypes.add('mustNotContain');
        }
        assertions.push(mkAssertion('mustNotContain', a.turnIndex, `answer not contains "${token}"`, [token], passed ? '未出现' : `包含 "${token}"`, passed, passed ? null : spanWithTurn(span, a.turnIndex)));
      }
      for (const [key, value] of Object.entries(expect.mustRecognize ?? {})) {
        const v = String(value);
        const span = findSpan(answer, v);
        const passed = span != null;
        if (passed) pushHighlight(highlights, span, 'fresh');
        else failedTypes.add('mustRecognize');
        assertions.push(mkAssertion('mustRecognize', a.turnIndex, `${key} == ${v}`, { [key]: value }, passed ? { [key]: value } : '未识别', passed, null));
      }
      for (const [key, value] of Object.entries(expect.mustUpdateContext ?? {})) {
        const v = String(value);
        const span = findSpan(answer, v);
        const passed = span != null;
        if (passed) pushHighlight(highlights, span, 'fresh');
        else failedTypes.add('mustUpdateContext');
        assertions.push(mkAssertion('mustUpdateContext', a.turnIndex, `${key} -> ${v}`, { [key]: value }, passed ? { [key]: value } : '未更新', passed, null));
      }
      for (const [key, staleValue] of Object.entries(expect.mustNotUseStaleContext ?? {})) {
        const v = String(staleValue);
        const span = findSpan(answer, v);
        const passed = span == null;
        if (!passed) {
          pushHighlight(highlights, span, 'stale');
          failedTypes.add('mustNotUseStaleContext');
        }
        assertions.push(mkAssertion('mustNotUseStaleContext', a.turnIndex, `${key} != ${v}`, { [key]: staleValue }, passed ? `未使用旧值` : { [key]: staleValue }, passed, passed ? null : spanWithTurn(span, a.turnIndex)));
      }
    }

    turns.push({ turnIndex: a.turnIndex, userInput: a.userInput ?? specByTurn.get(a.turnIndex)?.userInput ?? '', answer, latencyMs: a.latencyMs, status: a.status, highlights });
  }

  const passStatus = assertions.every((x) => x.passed) ? 'PASS' : 'FAIL';
  return { passStatus, failureType: deriveFailureType(failedTypes), assertions, turns };
}

function spanWithTurn(span: { start: number; end: number } | null, turnIndex: number) {
  return span ? { turnIndex, start: span.start, end: span.end } : null;
}

function mkAssertion(
  assertionType: AssertionType,
  turnIndex: number,
  expression: string,
  expectedValue: unknown,
  actualValue: unknown,
  passed: boolean,
  evidenceSpan: EvaluatedAssertion['evidenceSpan'],
): EvaluatedAssertion {
  return { assertionType, turnIndex, expression, expectedValue, actualValue, passed, evidenceSpan };
}

/** 失败类型：上下文类优先归为「上下文遗忘」，其余归「断言失败」。 */
export function deriveFailureType(failedTypes: Set<AssertionType>): string | null {
  if (failedTypes.size === 0) return null;
  if (CONTEXT_TYPES.some((t) => failedTypes.has(t))) return '上下文遗忘';
  return '断言失败';
}

export * from './stability';
export * from './comparison';
export * from './runner';
