/**
 * @author qtp
 * 单体后端数据层：Server Component / Route Handler 直读 SQLite。
 * 北极星两屏（执行对比 / 失败诊断）的查询都在这里。
 * 仅供 Server Component / Route Handler 使用。
 */
import { getPrisma } from '@ai-quality-platform/shared-database';

const parse = <T,>(s: string | null | undefined, fallback: T): T => {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

export type ResultChange = 'NEW_FAIL' | 'FIXED' | 'PERSIST_FAIL' | 'STABLE_PASS' | 'OTHER';

export interface TurnView {
  turnIndex: number;
  userInput: string;
  answer: string;
  latencyMs?: number;
  status?: string;
  highlights?: { start: number; end: number; kind: string }[];
}

export interface DiffRow {
  caseId: number;
  caseName: string;
  caseType: string;
  riskLevel: string;
  priority: string;
  baselineStatus: string;
  candidateStatus: string;
  change: ResultChange;
  failureType: string | null;
  candidateResultId: number | null;
  regressionVerdict: string | null;
  regressionConfidence: number | null;
}

export interface VersionCard {
  versionCode: string;
  versionType: string;
  promptVersion: string | null;
  modelVersion: string | null;
  commitId: string | null;
  changeNote: string | null;
}

export interface ComparisonView {
  comparisonCode: string;
  appCode: string;
  appName: string;
  status: string;
  releaseRecommendation: string | null;
  passRateDelta: number | null;
  newFailCount: number;
  fixedFailCount: number;
  persistentFailCount: number;
  stabilityScore: number | null;
  avgLatencyDeltaMs: number | null;
  summary: { degradationByType?: Record<string, number>; versionChange?: string[]; note?: string };
  baseline: { runCode: string; passRate: number; total: number; pass: number; fail: number; version: VersionCard | null };
  candidate: { runCode: string; passRate: number; total: number; pass: number; fail: number; version: VersionCard | null };
  rows: DiffRow[];
}

function classify(baseline: string | undefined, candidate: string | undefined): ResultChange {
  if (baseline === 'PASS' && candidate === 'FAIL') return 'NEW_FAIL';
  if (baseline === 'FAIL' && candidate === 'PASS') return 'FIXED';
  if (baseline === 'FAIL' && candidate === 'FAIL') return 'PERSIST_FAIL';
  if (baseline === 'PASS' && candidate === 'PASS') return 'STABLE_PASS';
  return 'OTHER';
}

const rate = (pass: number, total: number) => (total > 0 ? pass / total : 0);

export async function getComparison(comparisonCode: string): Promise<ComparisonView | null> {
  const prisma = getPrisma();
  const cmp = await prisma.comparison.findUnique({ where: { comparisonCode } });
  if (!cmp) return null;

  const [app, baseRun, candRun, baseVer, candVer, baseResults, candResults, cases] = await Promise.all([
    prisma.app.findUnique({ where: { appCode: cmp.appCode } }),
    prisma.regressionRun.findUnique({ where: { runCode: cmp.baselineRunCode } }),
    prisma.regressionRun.findUnique({ where: { runCode: cmp.candidateRunCode } }),
    cmp.baselineVersionCode
      ? prisma.appVersion.findUnique({ where: { appCode_versionCode: { appCode: cmp.appCode, versionCode: cmp.baselineVersionCode } } })
      : null,
    cmp.candidateVersionCode
      ? prisma.appVersion.findUnique({ where: { appCode_versionCode: { appCode: cmp.appCode, versionCode: cmp.candidateVersionCode } } })
      : null,
    prisma.caseResult.findMany({ where: { runCode: cmp.baselineRunCode } }),
    prisma.caseResult.findMany({ where: { runCode: cmp.candidateRunCode } }),
    prisma.testCase.findMany({ where: { appCode: cmp.appCode } }),
  ]);

  const caseById = new Map(cases.map((c) => [c.id, c]));
  const baseByCase = new Map(baseResults.map((r) => [r.caseId, r]));
  const candByCase = new Map(candResults.map((r) => [r.caseId, r]));

  const caseIds = new Set<number>([...baseByCase.keys(), ...candByCase.keys()]);
  const rows: DiffRow[] = [];
  for (const caseId of caseIds) {
    const b = baseByCase.get(caseId);
    const c = candByCase.get(caseId);
    const tc = caseById.get(caseId);
    rows.push({
      caseId,
      caseName: tc?.name ?? `用例 #${caseId}`,
      caseType: tc?.caseType ?? 'MULTI_TURN',
      riskLevel: c?.riskLevel ?? b?.riskLevel ?? tc?.riskLevel ?? 'MEDIUM',
      priority: tc?.priority ?? 'P1',
      baselineStatus: b?.passStatus ?? '—',
      candidateStatus: c?.passStatus ?? '—',
      change: classify(b?.passStatus, c?.passStatus),
      failureType: c?.failureType ?? null,
      candidateResultId: c?.id ?? null,
      regressionVerdict: c?.regressionVerdict ?? null,
      regressionConfidence: c?.regressionConfidence ?? null,
    });
  }
  // 退化（新增失败）排在最前
  const order: Record<ResultChange, number> = { NEW_FAIL: 0, PERSIST_FAIL: 1, FIXED: 2, OTHER: 3, STABLE_PASS: 4 };
  rows.sort((a, b) => order[a.change] - order[b.change]);

  const toCard = (v: typeof baseVer): VersionCard | null =>
    v ? { versionCode: v.versionCode, versionType: v.versionType, promptVersion: v.promptVersion, modelVersion: v.modelVersion, commitId: v.commitId, changeNote: v.changeNote } : null;

  return {
    comparisonCode: cmp.comparisonCode,
    appCode: cmp.appCode,
    appName: app?.appName ?? cmp.appCode,
    status: cmp.status,
    releaseRecommendation: cmp.releaseRecommendation,
    passRateDelta: cmp.passRateDelta,
    newFailCount: cmp.newFailCount,
    fixedFailCount: cmp.fixedFailCount,
    persistentFailCount: cmp.persistentFailCount,
    stabilityScore: cmp.stabilityScore,
    avgLatencyDeltaMs: cmp.avgLatencyDeltaMs,
    summary: parse(cmp.summary, {}),
    baseline: {
      runCode: cmp.baselineRunCode,
      passRate: rate(baseRun?.passCount ?? 0, baseRun?.totalCount ?? 0),
      total: baseRun?.totalCount ?? 0,
      pass: baseRun?.passCount ?? 0,
      fail: baseRun?.failCount ?? 0,
      version: toCard(baseVer),
    },
    candidate: {
      runCode: cmp.candidateRunCode,
      passRate: rate(candRun?.passCount ?? 0, candRun?.totalCount ?? 0),
      total: candRun?.totalCount ?? 0,
      pass: candRun?.passCount ?? 0,
      fail: candRun?.failCount ?? 0,
      version: toCard(candVer),
    },
    rows,
  };
}

export interface AssertionView {
  turnIndex: number | null;
  assertionType: string;
  expression: string | null;
  expectedValue: unknown;
  actualValue: unknown;
  passed: boolean;
}

export interface DiagnosisView {
  resultId: number;
  appCode: string;
  appName: string;
  caseName: string;
  caseType: string;
  riskLevel: string;
  candidateStatus: string;
  baselineStatus: string | null;
  failureType: string | null;
  regressionVerdict: string | null;
  regressionConfidence: number | null;
  sampleCount: number | null;
  stabilityScore: number | null;
  candidateVersion: string | null;
  baselineVersion: string | null;
  candidateTurns: TurnView[];
  baselineTurns: TurnView[];
  assertions: AssertionView[];
  diagnosis: {
    conclusion: string | null;
    primaryType: string | null;
    confidence: number | null;
    generatedBy: string | null;
    evidence: { source: string; turnIndex: number; text: string; span: { start: number; end: number } | null }[];
    possibleCauses: { name: string; confidenceLevel: string; note: string }[];
    suggestions: { text: string }[];
  } | null;
}

export async function getDiagnosis(resultId: number): Promise<DiagnosisView | null> {
  const prisma = getPrisma();
  const result = await prisma.caseResult.findUnique({
    where: { id: resultId },
    include: { case: true, assertions: { orderBy: { id: 'asc' } }, diagnosis: true },
  });
  if (!result) return null;

  const app = await prisma.app.findUnique({ where: { appCode: result.appCode } });
  const candRun = await prisma.regressionRun.findUnique({ where: { runCode: result.runCode } });

  // 找到对应对比与基线结果（同一用例）
  const cmp = await prisma.comparison.findFirst({ where: { candidateRunCode: result.runCode } });
  let baselineResult = null as Awaited<ReturnType<typeof prisma.caseResult.findFirst>> | null;
  if (cmp) {
    baselineResult = await prisma.caseResult.findFirst({
      where: { runCode: cmp.baselineRunCode, caseId: result.caseId },
    });
  }

  const d = result.diagnosis;
  return {
    resultId: result.id,
    appCode: result.appCode,
    appName: app?.appName ?? result.appCode,
    caseName: result.case.name,
    caseType: result.case.caseType,
    riskLevel: result.riskLevel,
    candidateStatus: result.passStatus,
    baselineStatus: baselineResult?.passStatus ?? null,
    failureType: result.failureType,
    regressionVerdict: result.regressionVerdict,
    regressionConfidence: result.regressionConfidence,
    sampleCount: result.sampleCount,
    stabilityScore: result.stabilityScore,
    candidateVersion: candRun?.versionCode ?? cmp?.candidateVersionCode ?? null,
    baselineVersion: cmp?.baselineVersionCode ?? null,
    candidateTurns: parse<TurnView[]>(result.turnsActual, []),
    baselineTurns: parse<TurnView[]>(baselineResult?.turnsActual, []),
    assertions: result.assertions.map((a) => ({
      turnIndex: a.turnIndex,
      assertionType: a.assertionType,
      expression: a.expression,
      expectedValue: parse(a.expectedValue, a.expectedValue),
      actualValue: parse(a.actualValue, a.actualValue),
      passed: a.passed,
    })),
    diagnosis: d
      ? {
          conclusion: d.conclusion,
          primaryType: d.primaryType,
          confidence: d.confidence,
          generatedBy: d.generatedBy,
          evidence: parse(d.evidence, []),
          possibleCauses: parse(d.possibleCauses, []),
          suggestions: parse(d.suggestions, []),
        }
      : null,
  };
}
