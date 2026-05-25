/**
 * 执行计划 & 执行历史 API
 * @author Antigravity/Claude-Sonnet-4.6
 */
import { postGateway } from '@/lib/api/gateway-client';

export interface PlanRecord {
  planCode: string;
  planName: string;
  appCode: string;
  planType: 'SMOKE' | 'FULL_REGRESSION' | 'HIGH_RISK' | 'CUSTOM';
  caseFilter: Record<string, unknown>;
  status: 'ENABLED' | 'DISABLED';
}

export interface RunRecord {
  runCode: string;
  planCode: string;
  appCode: string;
  status: 'RUNNING' | 'COMPLETED' | 'CANCELLED';
  totalCount: number;
  passCount: number;
  failCount: number;
  reviewCount: number;
  avgScore: number;
}

export interface ResultRecord {
  resultId: string;
  runCode: string;
  caseCode: string;
  finalAnswer: string;
  finalScore: number;
  passStatus: 'PASS' | 'FAIL' | 'REVIEW';
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
  planCode: string;
  planName: string;
  appCode: string;
  planType: string;
  caseFilter: Record<string, unknown>;
}): Promise<PlanRecord> {
  return postGateway<PlanRecord>('plan', '/plan/create.do', payload);
}

export async function deletePlan(planCode: string): Promise<void> {
  await postGateway('plan', '/plan/delete.do', { planCode });
}

export async function startPlan(planCode: string, appCode: string): Promise<RunRecord> {
  return postGateway<RunRecord>('execution', '/execution/start.do', {
    planCode,
    appCode,
    caseCodes: [],
  });
}

// ── 执行历史 API ──

export async function listRuns(appCode: string): Promise<RunRecord[]> {
  const res = await postGateway<unknown>('execution', '/execution/run-list.do', {
    page: { currentPage: 1, linesPerPage: 50 },
    data: { appCode },
  }, { cache: 'no-store' });
  const data = res as Record<string, unknown>;
  return (data?.list ?? []) as RunRecord[];
}

export async function listResults(runCode: string): Promise<ResultRecord[]> {
  const res = await postGateway<unknown>('execution', '/execution/result-list.do', {
    runCode,
    page: { currentPage: 1, linesPerPage: 200 },
  }, { cache: 'no-store' });
  const data = res as Record<string, unknown>;
  return (data?.list ?? []) as ResultRecord[];
}
