/**
 * @author qtp
 * 回归运行器：对一组用例逐个产出实际回答并用引擎评估。
 * AnswerProvider 是被测 AI 应用的接入点——
 *   - seed/测试用桩 provider 返回预置回答；
 *   - 真实 Adapter（HTTP JSON / OpenAI 兼容）实现同一接口即可接入（轨道 B）。
 */
import { evaluateCase, type CaseEvaluation, type TurnSpec, type TurnActual } from './index';

export interface RunnableCase {
  caseId: number;
  spec: TurnSpec[];
}

/** 给定用例（含各轮用户输入），产出该被测版本的实际逐轮回答。 */
export type AnswerProvider = (input: RunnableCase) => TurnActual[] | Promise<TurnActual[]>;

export interface CaseRunResult {
  caseId: number;
  answers: TurnActual[];
  evaluation: CaseEvaluation;
}

/** 跑一遍回归：每个用例取实际回答 → 引擎评估。 */
export async function runRegression(cases: RunnableCase[], provider: AnswerProvider): Promise<CaseRunResult[]> {
  const results: CaseRunResult[] = [];
  for (const c of cases) {
    const answers = await provider(c);
    results.push({ caseId: c.caseId, answers, evaluation: evaluateCase(c.spec, answers) });
  }
  return results;
}
