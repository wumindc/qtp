/**
 * 执行计划 & 执行历史 API
 * @author Antigravity/Claude-Sonnet-4.6
 * @author codex
 */
import { postGateway } from '@/lib/api/gateway-client';

export interface PlanRecord {
  planCode: string;
  planName: string;
  appCode: string;
  caseFilter: Record<string, unknown>;
  status: 'ENABLED' | 'DISABLED';
}

export interface RunRecord {
  runCode: string;
  planCode: string;
  planName?: string;
  sequenceNo?: number;
  appCode: string;
  status: 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  phase?: 'PENDING' | 'APP_CALLING' | 'EVALUATING' | 'COSTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  totalCount: number;
  appCompletedCount?: number;
  evalCompletedCount?: number;
  passCount: number;
  failCount: number;
  reviewCount: number;
  avgScore: number;
  normalInputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  totalCostAmount?: number | null;
  currency?: string;
  costStatus?: 'NOT_CALCULATED' | 'CALCULATED' | 'NO_USAGE' | 'SKIPPED_NO_PRICE' | 'PARTIAL';
  /** 执行开始时间（ISO 字符串） */
  startAt?: string;
  /** 执行结束时间 */
  endAt?: string;
  /** 耗时（毫秒） */
  durationMs?: number;
}

export type RunVersionRecord = Pick<
  RunRecord,
  | 'runCode'
  | 'planCode'
  | 'appCode'
  | 'sequenceNo'
  | 'status'
  | 'totalCount'
  | 'passCount'
  | 'failCount'
  | 'reviewCount'
  | 'avgScore'
  | 'startAt'
  | 'endAt'
  | 'durationMs'
>;

export interface ResultRecord {
  resultId: string;
  runCode: string;
  caseCode: string;
  caseName?: string;
  /** 来自 caseSnapshot，用于前端分类导航 */
  categoryId?: string;
  query?: string;
  expectedBehavior?: string;
  requestJson?: Record<string, unknown>;
  responseJson?: Record<string, unknown>;
  appStatus?: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'SKIPPED';
  evaluationStatus?: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'SKIPPED';
  finalAnswer: string;
  finalScore: number;
  passStatus: 'PASS' | 'FAIL' | 'REVIEW';
  failureReason?: string;
  problemType?: string;
  elapsedMs?: number;
  appElapsedMs?: number;
  judgeElapsedMs?: number;
  errorCode?: string;
  hasJudgeCall?: boolean;
  manualResult?: 'PASS' | 'FAIL' | null;
  reviewStatus?: 'PENDING' | 'REVIEWED';
  reviewComment?: string;
}

export interface JudgeCallDetail {
  callCode: string;
  status: 'SUCCEEDED' | 'FAILED';
  providerCode: string;
  modelId: string;
  protocol: string;
  promptText: string;
  requestJson: Record<string, unknown>;
  responseJson?: Record<string, unknown>;
  rawResponseText?: string;
  rawUsageJson?: Record<string, unknown>;
  normalInputTokens?: number | null;
  cachedInputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  normalInputCostAmount?: number | null;
  cachedInputCostAmount?: number | null;
  outputCostAmount?: number | null;
  totalCostAmount?: number | null;
  currency?: string;
  costStatus?: RunRecord['costStatus'];
  errorCode?: string;
  errorMessage?: string;
  elapsedMs?: number;
}

export interface ResultReviewRecord {
  resultId: string;
  reviewStatus: 'PENDING' | 'REVIEWED';
  manualResult?: 'PASS' | 'FAIL' | null;
  problemType?: string;
  reviewComment?: string;
  nextAction?: string;
  reviewer?: string;
}

// ── 计划 API ──

export async function listPlans(appCode: string): Promise<PlanRecord[]> {
  const res = await postGateway<unknown>('plan', '/plan/list.do', {
    page: { currentPage: 1, linesPerPage: 100 },
    data: { appCode },
  }, { cache: 'no-store' });
  const data = res as Record<string, unknown>;
  return (data?.list ?? []) as PlanRecord[];
}

export async function createPlan(payload: {
  planCode?: string;
  planName: string;
  appCode: string;
  caseFilter: Record<string, unknown>;
}): Promise<PlanRecord> {
  return postGateway<PlanRecord>('plan', '/plan/create.do', payload);
}

export async function updatePlan(
  planCode: string,
  payload: {
    planName?: string;
    appCode?: string;
    caseFilter?: Record<string, unknown>;
  },
): Promise<PlanRecord> {
  return postGateway<PlanRecord>('plan', '/plan/update.do', {
    planCode,
    data: payload,
  });
}

export async function deletePlan(planCode: string): Promise<void> {
  await postGateway('plan', '/plan/delete.do', { planCode });
}

export async function startPlan(planCode: string, appCode: string, caseCodes: string[] = []): Promise<RunRecord> {
  return postGateway<RunRecord>('execution', '/execution/start.do', {
    planCode,
    appCode,
    caseCodes,
  });
}

// ── 执行历史 API ──

export async function listRuns(appCode: string): Promise<RunRecord[]> {
  const res = await postGateway<unknown>('execution', '/execution/run-list.do', {
    page: { currentPage: 1, linesPerPage: 100 },
    data: { appCode },
  }, { cache: 'no-store' });
  const data = res as Record<string, unknown>;
  return (data?.list ?? []) as RunRecord[];
}

/**
 * 按 planCode 查询该计划的执行历史（前端过滤兼容）
 */
export async function listRunsByPlan(planCode: string, appCode: string): Promise<RunRecord[]> {
  const all = await listRuns(appCode);
  return all.filter((r) => r.planCode === planCode);
}

/**
 * 查询单次执行的最新状态（用于轮询）
 */
export async function getRunStatus(runCode: string): Promise<RunRecord | null> {
  try {
    const res = await postGateway<unknown>('execution', '/execution/run-detail.do', {
      runCode,
    }, { cache: 'no-store' });
    return (res as RunRecord) ?? null;
  } catch {
    return null;
  }
}

export async function listRunVersions(runCode: string): Promise<RunVersionRecord[]> {
  const res = await postGateway<unknown>('execution', '/execution/run-versions.do', {
    runCode,
  }, { cache: 'no-store' });
  return (Array.isArray(res) ? res : []) as RunVersionRecord[];
}

export async function listResults(runCode: string): Promise<ResultRecord[]> {
  const res = await postGateway<unknown>('execution', '/execution/result-list.do', {
    runCode,
    page: { currentPage: 1, linesPerPage: 200 },
  }, { cache: 'no-store' });
  const data = res as Record<string, unknown>;
  return (data?.list ?? []) as ResultRecord[];
}

export async function loadJudgeCallDetail(resultId: string): Promise<JudgeCallDetail> {
  return postGateway<JudgeCallDetail>('execution', '/execution/judge-call/detail.do', { resultId }, { cache: 'no-store' });
}

export async function recalculateRunCost(runCode: string): Promise<RunRecord> {
  return postGateway<RunRecord>('execution', '/execution/cost/recalculate.do', { runCode });
}

export async function submitResultReview(payload: {
  resultId: string;
  manualResult: 'PASS' | 'FAIL' | null;
  reviewComment?: string;
  problemType?: string;
}): Promise<ResultReviewRecord> {
  return postGateway<ResultReviewRecord>('review', '/review/submit.do', {
    ...payload,
    reviewer: '管理员',
  });
}

/**
 * 仅重新发起 AI 评估，不重新调用业务接口。
 * @author Antigravity/Claude-Sonnet-4.6
 */
export async function reEvaluateResults(resultIds: string[]): Promise<ResultRecord[]> {
  const res = await postGateway<unknown>('execution', '/execution/re-evaluate.do', { resultIds });
  return (Array.isArray(res) ? res : []) as ResultRecord[];
}

/** 从旧版 runCode 末尾时间戳解析执行时间（仅兼容历史数据） */
export function parseRunStartTime(runCode: string): Date | null {
  const ts = runCode.split('_RUN_')[1];
  if (!ts) return null;
  const num = Number(ts);
  return isNaN(num) ? null : new Date(num);
}

/** 格式化耗时为人类可读 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}
