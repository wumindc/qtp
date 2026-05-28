/**
 * 执行服务：按计划筛选用例、调用应用协议并持久化真实执行结果
 * @author codex
 */
import { randomBytes } from 'node:crypto';
import {
  AiInvocationClient,
  toInvocationAuditJson,
  type ModelInvocationRequest,
  type ProviderInvocationKind,
} from '@ai-quality-platform/ai-invocation-client';
import {
  validateApplicationInvokeUrl,
  normalizeApplicationRequestHeaders,
} from '@ai-quality-platform/shared-config';
import { createRuntimePrismaClient } from '@ai-quality-platform/shared-database';
import { pageResult, type PageResult } from '@ai-quality-platform/shared-http';
import { BadRequestException } from '@nestjs/common';
import { calculateJudgeCost, type JudgeCost, type ModelPricing } from './judge-cost';
import { normalizeJudgeUsage, type NormalizedJudgeUsage } from './judge-usage';

type RunStatus = 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
type RunPhase = 'PENDING' | 'APP_CALLING' | 'EVALUATING' | 'COSTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
type ResultPhaseStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'SKIPPED';

export interface RunRecord {
  runCode: string;
  planCode: string;
  planName?: string;
  sequenceNo?: number;
  appCode: string;
  status: RunStatus;
  phase?: RunPhase;
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
  normalInputCostAmount?: number | null;
  cachedInputCostAmount?: number | null;
  outputCostAmount?: number | null;
  totalCostAmount?: number | null;
  currency?: string;
  costStatus?: 'NOT_CALCULATED' | 'CALCULATED' | 'NO_USAGE' | 'SKIPPED_NO_PRICE' | 'PARTIAL';
  startAt?: string;
  endAt?: string;
  durationMs?: number;
}

export interface RunVersionRecord {
  runCode: string;
  planCode: string;
  appCode: string;
  sequenceNo?: number;
  status: RunRecord['status'];
  totalCount: number;
  passCount: number;
  failCount: number;
  reviewCount: number;
  avgScore: number;
  startAt?: string;
  endAt?: string;
  durationMs?: number;
}

export interface ResultRecord {
  resultId: string;
  runCode: string;
  caseCode: string;
  /** 来自 caseSnapshot，用于前端分类导航 */
  categoryId?: string;
  query?: string;
  expectedBehavior?: string;
  requestJson?: Record<string, unknown>;
  responseJson?: Record<string, unknown>;
  caseSnapshotJson?: Record<string, unknown>;
  appStatus?: ResultPhaseStatus;
  evaluationStatus?: ResultPhaseStatus;
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

interface ExecutionCaseRecord {
  id: string;
  appCode: string;
  caseScope?: 'APP' | 'SYSTEM_PRESET';
  categoryId: string;
  inputJson: Record<string, unknown>;
  expectedJson: Record<string, unknown>;
  query: string;
  expectedBehavior: string;
  enabled: boolean;
}

interface ExecutionPlanRecord {
  planCode: string;
  planName: string;
  appCode: string;
  caseFilter: Record<string, unknown>;
  status: 'ENABLED' | 'DISABLED';
}

interface ExecutionAppRecord {
  appCode: string;
  appName: string;
  requestMethod: 'GET' | 'POST';
  invokeUrl: string;
  headerTemplate: string;
  bodyTemplate: string;
  streamEnabled: boolean;
  adapterConfig: {
    response: {
      answerPath: string;
      successExpression: string;
    };
    execution?: {
      appConcurrency: number;
    };
  };
}

interface EvaluationConfigRecord {
  appCode: string;
  modelId: string;
  promptOverrideEnabled: boolean;
  systemPrompt: string;
  customPrompt: string;
  effectivePrompt: string;
  evaluationConcurrency?: number;
}

interface JudgeModelRecord {
  id: string;
  modelName: string;
  providerCode: string;
  modelId: string;
  modelType: 'LLM' | 'EMBEDDING';
  protocol: string;
  parameters: Record<string, unknown>;
  limits?: {
    pricing?: ModelPricing;
  };
  enabled: boolean;
}

interface JudgeProviderRecord {
  providerCode: string;
  providerName: string;
  providerType: ProviderInvocationKind;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
}

interface JudgeContext {
  config: EvaluationConfigRecord;
  model: JudgeModelRecord;
  provider: JudgeProviderRecord;
}

interface EvaluationScore {
  finalScore: number;
  passStatus: 'PASS' | 'FAIL' | 'REVIEW';
  failureReason: string;
  problemType?: string;
  errorCode?: string;
}

interface JudgeEvaluationResult {
  score: EvaluationScore;
  call: JudgeCallRecord;
}

class JudgeInvocationError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'JudgeInvocationError';
  }
}

export interface JudgeCallRecord {
  callCode: string;
  runCode: string;
  resultId: string;
  appCode: string;
  caseId: string;
  providerCode: string;
  modelDbId: string;
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
  costStatus: JudgeCost['costStatus'];
  status: 'SUCCEEDED' | 'FAILED';
  errorCode?: string;
  errorMessage?: string;
  elapsedMs?: number;
}

export interface WorkerHealth {
  enabled: boolean;
  activeRunCount: number;
  runningRunCount: number;
  lastHeartbeatAt?: string;
  lastRecoveryAt?: string;
  lastRecoveryStatus?: 'SUCCEEDED' | 'FAILED' | 'IDLE';
  recoveredRunCount?: number;
  lastError?: string;
}

type ExecutionDataStore = {
  listCases(): Promise<ExecutionCaseRecord[] | null>;
  listRuns(): Promise<RunRecord[] | null>;
  findRun(runCode: string): Promise<RunRecord | null | undefined>;
  createRun(run: RunRecord): Promise<RunRecord | null>;
  updateRun(run: RunRecord): Promise<RunRecord | null>;
  createResult(result: ResultRecord, testCase: ExecutionCaseRecord): Promise<ResultRecord | null>;
  updateResult?(result: ResultRecord, testCase?: ExecutionCaseRecord): Promise<ResultRecord | null>;
  listResults(runCode: string): Promise<ResultRecord[] | null>;
  createJudgeCall?(call: JudgeCallRecord): Promise<JudgeCallRecord | null>;
  updateJudgeCall?(call: JudgeCallRecord): Promise<JudgeCallRecord | null>;
  listJudgeCalls?(runCode: string): Promise<JudgeCallRecord[] | null>;
  findJudgeCallByResult?(resultId: string): Promise<JudgeCallRecord | null | undefined>;
  findPlan?(planCode: string): Promise<ExecutionPlanRecord | null | undefined>;
  findApp?(appCode: string): Promise<ExecutionAppRecord | null | undefined>;
  findEvaluationConfig?(appCode: string): Promise<EvaluationConfigRecord | null | undefined>;
  findJudgeModel?(modelId: string): Promise<JudgeModelRecord | null | undefined>;
  findJudgeProvider?(providerCode: string): Promise<JudgeProviderRecord | null | undefined>;
  listSubscriptions(appCode: string): Promise<Array<{ appCode: string; categoryId: string }> | null>;
};

type BackgroundRunner = (task: () => Promise<void>) => void;

interface ExecutionServiceDeps {
  database?: ExecutionDataStore;
  fetchImpl?: typeof fetch;
  aiInvocationClient?: AiInvocationClient;
  backgroundRunner?: BackgroundRunner;
  recoverOnStart?: boolean;
  workerEnabled?: boolean;
}

type ExecutionPrismaClient = {
  aiApp: {
    findUnique(input: { where: { appCode: string } }): Promise<unknown | null>;
  };
  evalPlan: {
    findUnique(input: { where: { planCode: string } }): Promise<unknown | null>;
  };
  appEvaluationConfig: {
    findUnique(input: { where: { appCode: string } }): Promise<unknown | null>;
  };
  aiModel: {
    findUnique(input: { where: { id: bigint } }): Promise<unknown | null>;
  };
  aiProvider: {
    findUnique(input: { where: { providerCode: string } }): Promise<unknown | null>;
  };
  evalCase: {
    findMany(input?: { orderBy?: object }): Promise<unknown[]>;
  };
  evalRun: {
    findMany(input?: { orderBy?: object }): Promise<unknown[]>;
    findUnique(input: { where: { runCode: string } }): Promise<unknown | null>;
    create(input: { data: object }): Promise<unknown>;
    update(input: { where: { runCode: string }; data: object }): Promise<unknown>;
  };
  evalResult: {
    findMany(input?: { where?: object; orderBy?: object }): Promise<unknown[]>;
    create(input: { data: object }): Promise<unknown>;
    update(input: { where: { id: bigint }; data: object }): Promise<unknown>;
  };
  evalJudgeCall: {
    findMany(input?: { where?: object; orderBy?: object }): Promise<unknown[]>;
    findFirst(input?: { where?: object; orderBy?: object }): Promise<unknown | null>;
    create(input: { data: object }): Promise<unknown>;
    update(input: { where: { callCode: string }; data: object }): Promise<unknown>;
  };
  evalReview: {
    findMany(input?: { where?: object; orderBy?: object }): Promise<unknown[]>;
  };
  appPresetCategory: {
    findMany(input?: { where?: object; orderBy?: object }): Promise<unknown[]>;
  };
};

const DEFAULT_APP_PROTOCOL_TIMEOUT_MS = 30_000;
const DEFAULT_EXECUTION_CONCURRENCY = 3;
const MIN_EXECUTION_CONCURRENCY = 1;
const MAX_EXECUTION_CONCURRENCY = 10;
const DEFAULT_JUDGE_TIMEOUT_MS = 180_000;
const MIN_JUDGE_TIMEOUT_MS = 10_000;
const MAX_JUDGE_TIMEOUT_MS = 600_000;
const JUDGE_TIMEOUT_STEP_CHARS = 1_000;
const JUDGE_TIMEOUT_STEP_MS = 30_000;
const DEFAULT_JUDGE_MAX_OUTPUT_TOKENS = 512;
const MIN_JUDGE_MAX_OUTPUT_TOKENS = 128;
const MAX_JUDGE_MAX_OUTPUT_TOKENS = 1024;
const OPAQUE_ID_LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const OPAQUE_ID_ALPHABET = `${OPAQUE_ID_LETTERS}0123456789`;
const OPAQUE_ID_LENGTH = 10;
const DEFAULT_EVALUATION_PROMPT = [
  '你是 AI 应用质量评估裁判。',
  '请根据测试用例的问题内容、期望回答和被测应用实际回答，判断实际回答是否满足期望。',
  '只返回 JSON，不要输出 Markdown。格式：{"passStatus":"PASS|FAIL|REVIEW","score":0-100,"reason":"评分理由","problemType":"问题类型"}。',
  '当实际回答明确满足期望时给 PASS；明显不满足时给 FAIL；证据不足或需要人工判断时给 REVIEW。',
].join('\n');

function createOpaqueId(prefix: string): string {
  const bytes = randomBytes(OPAQUE_ID_LENGTH);
  const suffix = [
    OPAQUE_ID_LETTERS[bytes[0] % OPAQUE_ID_LETTERS.length],
    ...Array.from(bytes.subarray(1), (byte) => OPAQUE_ID_ALPHABET[byte % OPAQUE_ID_ALPHABET.length]),
  ].join('');
  return `${prefix}-${suffix}`;
}

function readRequiredProtocolString(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(message);
  return value;
}

function readProtocolString(value: unknown, message: string): string {
  if (typeof value !== 'string') throw new Error(message);
  return value;
}

function readRequiredProtocolBoolean(value: unknown, message: string): boolean {
  if (typeof value !== 'boolean') throw new Error(message);
  return value;
}

function readAppRequestMethod(value: unknown): ExecutionAppRecord['requestMethod'] {
  if (value === 'GET' || value === 'POST') return value;
  throw new Error('当前仅支持 GET/POST 请求方法');
}

function readRequiredSnapshotString(value: unknown, message: string) {
  if (typeof value === 'string' && value.trim()) return value;
  throw new Error(message);
}

function readCaseSnapshotFields(caseSnapshotJson: Record<string, unknown>) {
  return {
    categoryId: readRequiredSnapshotString(caseSnapshotJson.categoryId, '执行结果快照缺少分类 ID'),
    query: readRequiredSnapshotString(caseSnapshotJson.question, '执行结果快照缺少问题内容'),
    expectedBehavior: readRequiredSnapshotString(caseSnapshotJson.expectedAnswer, '执行结果快照缺少期望回答'),
  };
}

function persistedBigIntId(value: string, fieldName: string): bigint {
  if (!/^\d+$/u.test(value)) {
    throw new Error(`${fieldName}不是已持久化数据库 ID`);
  }
  return BigInt(value);
}

class ExecutionDatabase implements ExecutionDataStore {
  private readonly prismaPromise = this.createClient();

  /**
   * @author codex
   * Persists execution runs and results in MySQL so history is always backed by real execution records.
   */
  async listCases(): Promise<ExecutionCaseRecord[] | null> {
    const prisma = await this.prismaPromise;
    const rows = await prisma.evalCase.findMany({ orderBy: { id: 'asc' } });
    return rows.map((row) => this.toCase(row));
  }

  async listSubscriptions(appCode: string): Promise<Array<{ appCode: string; categoryId: string }> | null> {
    const prisma = await this.prismaPromise;
    const rows = (await prisma.appPresetCategory.findMany({ where: { appCode }, orderBy: { id: 'asc' } })) as Array<{ appCode: unknown; categoryId: unknown }>;
    return rows.map((row) => ({
      appCode: String(row.appCode),
      categoryId: String(row.categoryId),
    }));
  }

  async findPlan(planCode: string): Promise<ExecutionPlanRecord | null | undefined> {
    const prisma = await this.prismaPromise;
    const row = await prisma.evalPlan.findUnique({ where: { planCode } });
    return row ? this.toPlan(row) : null;
  }

  async findApp(appCode: string): Promise<ExecutionAppRecord | null | undefined> {
    const prisma = await this.prismaPromise;
    const row = await prisma.aiApp.findUnique({ where: { appCode } });
    return row ? this.toApp(row) : null;
  }

  async findEvaluationConfig(appCode: string): Promise<EvaluationConfigRecord | null | undefined> {
    const prisma = await this.prismaPromise;
    const row = await prisma.appEvaluationConfig.findUnique({ where: { appCode } });
    return row ? this.toEvaluationConfig(row) : null;
  }

  async findJudgeModel(modelId: string): Promise<JudgeModelRecord | null | undefined> {
    const prisma = await this.prismaPromise;
    const row = await prisma.aiModel.findUnique({ where: { id: BigInt(modelId) } });
    return row ? this.toJudgeModel(row) : null;
  }

  async findJudgeProvider(providerCode: string): Promise<JudgeProviderRecord | null | undefined> {
    const prisma = await this.prismaPromise;
    const row = await prisma.aiProvider.findUnique({ where: { providerCode } });
    return row ? this.toJudgeProvider(row) : null;
  }

  async listRuns(): Promise<RunRecord[] | null> {
    const prisma = await this.prismaPromise;
    const rows = await prisma.evalRun.findMany({ orderBy: { id: 'desc' } });
    return rows.map((row) => this.toRun(row));
  }

  async findRun(runCode: string): Promise<RunRecord | null | undefined> {
    const prisma = await this.prismaPromise;
    const row = await prisma.evalRun.findUnique({ where: { runCode } });
    return row ? this.toRun(row) : null;
  }

  async createRun(run: RunRecord): Promise<RunRecord | null> {
    const prisma = await this.prismaPromise;
    const startedAt = run.startAt ? new Date(run.startAt) : new Date();
    const finishedAt = run.status === 'RUNNING' ? null : run.endAt ? new Date(run.endAt) : new Date();
    const saved = await prisma.evalRun.create({
      data: {
        runCode: run.runCode,
        planCode: run.planCode,
        appCode: run.appCode,
        sequenceNo: run.sequenceNo,
        status: run.status,
        phase: run.phase,
        totalCount: run.totalCount,
        appCompletedCount: run.appCompletedCount,
        evalCompletedCount: run.evalCompletedCount,
        passCount: run.passCount,
        failCount: run.failCount,
        reviewCount: run.reviewCount,
        avgScore: run.avgScore,
        normalInputCostAmount: run.normalInputCostAmount,
        cachedInputCostAmount: run.cachedInputCostAmount,
        outputCostAmount: run.outputCostAmount,
        totalCostAmount: run.totalCostAmount,
        currency: run.currency,
        costStatus: run.costStatus,
        startedAt,
        finishedAt,
      },
    });
    return this.toRun(saved);
  }

  async updateRun(run: RunRecord): Promise<RunRecord | null> {
    const prisma = await this.prismaPromise;
    const finishedAt = run.status === 'RUNNING' ? null : run.endAt ? new Date(run.endAt) : new Date();
    const saved = await prisma.evalRun.update({
      where: { runCode: run.runCode },
      data: {
        status: run.status,
        phase: run.phase,
        totalCount: run.totalCount,
        appCompletedCount: run.appCompletedCount,
        evalCompletedCount: run.evalCompletedCount,
        passCount: run.passCount,
        failCount: run.failCount,
        reviewCount: run.reviewCount,
        avgScore: run.avgScore,
        normalInputTokens: run.normalInputTokens,
        cachedInputTokens: run.cachedInputTokens,
        outputTokens: run.outputTokens,
        totalTokens: run.totalTokens,
        normalInputCostAmount: run.normalInputCostAmount,
        cachedInputCostAmount: run.cachedInputCostAmount,
        outputCostAmount: run.outputCostAmount,
        totalCostAmount: run.totalCostAmount,
        currency: run.currency,
        costStatus: run.costStatus,
        finishedAt,
      },
    });
    return this.toRun(saved);
  }

  async createResult(result: ResultRecord, testCase: ExecutionCaseRecord): Promise<ResultRecord | null> {
    const prisma = await this.prismaPromise;
    const saved = await prisma.evalResult.create({
      data: {
        runCode: result.runCode,
        caseId: persistedBigIntId(testCase.id, '用例 ID'),
        appCode: testCase.appCode,
        caseSnapshotJson: this.readRequiredRecord(result.caseSnapshotJson, '执行结果缺少用例快照 JSON'),
        appStatus: this.readResultPhaseStatus(result.appStatus, '执行结果缺少应用调用阶段状态'),
        evaluationStatus: this.readResultPhaseStatus(result.evaluationStatus, '执行结果缺少评估阶段状态'),
        requestJson: this.readRequiredRecord(result.requestJson, '执行结果缺少请求 JSON'),
        responseJson: result.responseJson ?? null,
        finalAnswer: result.finalAnswer,
        finalScore: result.finalScore,
        passStatus: result.passStatus,
        failureReason: result.failureReason ?? null,
        problemType: result.problemType ?? null,
        elapsedMs: result.elapsedMs ?? null,
        appElapsedMs: result.appElapsedMs ?? null,
        judgeElapsedMs: result.judgeElapsedMs ?? null,
        errorCode: result.errorCode ?? null,
      },
    });
    return this.toResult(saved);
  }

  async updateResult(result: ResultRecord, testCase?: ExecutionCaseRecord): Promise<ResultRecord | null> {
    const prisma = await this.prismaPromise;
    const saved = await prisma.evalResult.update({
      where: { id: persistedBigIntId(result.resultId, '执行结果 ID') },
      data: {
        caseSnapshotJson: this.readRequiredRecord(result.caseSnapshotJson, '执行结果缺少用例快照 JSON'),
        appStatus: this.readResultPhaseStatus(result.appStatus, '执行结果缺少应用调用阶段状态'),
        evaluationStatus: this.readResultPhaseStatus(result.evaluationStatus, '执行结果缺少评估阶段状态'),
        requestJson: this.readRequiredRecord(result.requestJson, '执行结果缺少请求 JSON'),
        responseJson: result.responseJson ?? null,
        finalAnswer: result.finalAnswer,
        finalScore: result.finalScore,
        passStatus: result.passStatus,
        failureReason: result.failureReason ?? null,
        problemType: result.problemType ?? null,
        elapsedMs: result.elapsedMs ?? null,
        appElapsedMs: result.appElapsedMs ?? null,
        judgeElapsedMs: result.judgeElapsedMs ?? null,
        errorCode: result.errorCode ?? null,
      },
    });
    return this.toResult(saved);
  }

  async listResults(runCode: string): Promise<ResultRecord[] | null> {
    const prisma = await this.prismaPromise;
    const rows = await prisma.evalResult.findMany({ where: { runCode }, orderBy: { id: 'asc' } });
    const results = rows.map((row) => this.toResult(row));
    const resultIds = results
      .map((result) => result.resultId)
      .filter((resultId) => /^\d+$/u.test(resultId))
      .map((resultId) => BigInt(resultId));
    if (resultIds.length === 0) return results;

    const reviewRows = await prisma.evalReview.findMany({
      where: { resultId: { in: resultIds } },
      orderBy: { id: 'desc' },
    });
    const reviewByResultId = new Map<string, Pick<ResultRecord, 'manualResult' | 'reviewStatus' | 'reviewComment'>>();
    for (const row of reviewRows) {
      const review = this.toResultReview(row);
      if (!reviewByResultId.has(review.resultId)) {
        reviewByResultId.set(review.resultId, review);
      }
    }
    return results.map((result) => ({ ...result, ...reviewByResultId.get(result.resultId) }));
  }

  async createJudgeCall(call: JudgeCallRecord): Promise<JudgeCallRecord | null> {
    const prisma = await this.prismaPromise;
    const saved = await prisma.evalJudgeCall.create({ data: this.toJudgeCallPayload(call) });
    return this.toJudgeCall(saved);
  }

  async updateJudgeCall(call: JudgeCallRecord): Promise<JudgeCallRecord | null> {
    const prisma = await this.prismaPromise;
    const saved = await prisma.evalJudgeCall.update({
      where: { callCode: call.callCode },
      data: this.toJudgeCallPayload(call),
    });
    return this.toJudgeCall(saved);
  }

  async listJudgeCalls(runCode: string): Promise<JudgeCallRecord[] | null> {
    const prisma = await this.prismaPromise;
    const rows = await prisma.evalJudgeCall.findMany({ where: { runCode }, orderBy: { id: 'asc' } });
    return rows.map((row) => this.toJudgeCall(row));
  }

  async findJudgeCallByResult(resultId: string): Promise<JudgeCallRecord | null | undefined> {
    const prisma = await this.prismaPromise;
    if (!/^\d+$/u.test(resultId)) return null;
    const row = await prisma.evalJudgeCall.findFirst({ where: { resultId: BigInt(resultId) }, orderBy: { id: 'desc' } });
    return row ? this.toJudgeCall(row) : null;
  }

  private toJudgeCallPayload(call: JudgeCallRecord) {
    return {
      callCode: call.callCode,
      runCode: call.runCode,
      resultId: persistedBigIntId(call.resultId, '执行结果 ID'),
      appCode: call.appCode,
      caseId: persistedBigIntId(call.caseId, '用例 ID'),
      providerCode: call.providerCode,
      modelDbId: persistedBigIntId(call.modelDbId, '模型数据库 ID'),
      modelId: call.modelId,
      protocol: call.protocol,
      promptText: call.promptText,
      requestJson: call.requestJson,
      responseJson: call.responseJson ?? null,
      rawResponseText: call.rawResponseText ?? null,
      rawUsageJson: call.rawUsageJson ?? null,
      normalInputTokens: call.normalInputTokens ?? null,
      cachedInputTokens: call.cachedInputTokens ?? null,
      outputTokens: call.outputTokens ?? null,
      totalTokens: call.totalTokens ?? null,
      normalInputCostAmount: call.normalInputCostAmount ?? null,
      cachedInputCostAmount: call.cachedInputCostAmount ?? null,
      outputCostAmount: call.outputCostAmount ?? null,
      totalCostAmount: call.totalCostAmount ?? null,
      currency: call.currency ?? null,
      costStatus: call.costStatus,
      status: call.status,
      errorCode: call.errorCode ?? null,
      errorMessage: call.errorMessage ?? null,
      elapsedMs: call.elapsedMs ?? null,
    };
  }

  private async createClient() {
    return createRuntimePrismaClient<ExecutionPrismaClient>();
  }

  private toCase(row: unknown): ExecutionCaseRecord {
    const data = this.readRecord(row, '执行用例记录格式不正确');
    const inputJson = this.readRequiredRecord(data.inputJson, '执行用例记录缺少输入 JSON');
    const expectedJson = this.readRequiredRecord(data.expectedJson, '执行用例记录缺少期望 JSON');
    return {
      id: this.readRequiredBigIntId(data.id, '执行用例记录缺少数据库 ID'),
      appCode: this.readRequiredString(data.appCode, '执行用例记录缺少应用编码'),
      caseScope: this.readCaseScope(data.caseScope),
      categoryId: this.readRequiredBigIntId(data.categoryId, '执行用例记录缺少分类 ID'),
      inputJson,
      expectedJson,
      query: this.readRequiredString(inputJson.query, '执行用例记录缺少问题内容'),
      expectedBehavior: this.readRequiredString(expectedJson.expectedBehavior, '执行用例记录缺少期望回答'),
      enabled: this.readBoolean(data.enabled, '执行用例记录缺少启停状态'),
    };
  }

  private toPlan(row: unknown): ExecutionPlanRecord {
    const data = this.readRecord(row, '执行计划记录格式不正确');
    return {
      planCode: this.readRequiredString(data.planCode, '执行计划记录缺少计划编码'),
      planName: this.readRequiredString(data.planName, '执行计划记录缺少计划名称'),
      appCode: this.readRequiredString(data.appCode, '执行计划记录缺少应用编码'),
      caseFilter: this.readRequiredRecord(data.caseFilterJson, '执行计划记录缺少用例筛选条件'),
      status: this.readPlanStatus(data.status),
    };
  }

  private toApp(row: unknown): ExecutionAppRecord {
    const data = this.readRecord(row, '应用协议记录格式不正确');
    const adapterConfig = this.asRecord(data.adapterConfig);
    const response = this.asRecord(adapterConfig.response);
    const templates = this.asRecord(adapterConfig.templates);
    const execution = this.asRecord(adapterConfig.execution);
    return {
      appCode: this.readRequiredString(data.appCode, '应用协议记录缺少应用编码'),
      appName: this.readRequiredString(data.appName, '应用协议记录缺少应用名称'),
      requestMethod: readAppRequestMethod(data.requestMethod),
      invokeUrl: this.readRequiredString(data.invokeUrl, '应用协议记录缺少调用地址'),
      headerTemplate: readRequiredProtocolString(templates.headerTemplate, '应用协议缺少请求头模板'),
      bodyTemplate: readRequiredProtocolString(templates.bodyTemplate, '应用协议缺少请求体模板'),
      streamEnabled: readRequiredProtocolBoolean(templates.streamEnabled, '应用协议缺少流式响应配置'),
      adapterConfig: {
        response: {
          answerPath: readRequiredProtocolString(response.answerPath, '应用协议缺少答案路径'),
          successExpression: readProtocolString(response.successExpression, '应用协议缺少成功表达式'),
        },
        execution: {
          appConcurrency: this.normalizeConcurrency(execution.appConcurrency),
        },
      },
    };
  }

  private toEvaluationConfig(row: unknown): EvaluationConfigRecord {
    const data = this.readRecord(row, '评估配置记录格式不正确');
    const promptOverrideEnabled = this.readBoolean(data.promptOverrideEnabled, '评估配置记录缺少提示词覆盖开关');
    const customPrompt = this.readOptionalString(data.customPrompt, '评估配置自定义提示词不是字符串');
    return {
      appCode: this.readRequiredString(data.appCode, '评估配置记录缺少应用编码'),
      modelId: this.readRequiredBigIntId(data.modelId, '评估配置记录缺少模型 ID'),
      promptOverrideEnabled,
      systemPrompt: DEFAULT_EVALUATION_PROMPT,
      customPrompt,
      effectivePrompt: promptOverrideEnabled && customPrompt ? customPrompt : DEFAULT_EVALUATION_PROMPT,
      evaluationConcurrency: this.readConcurrency(data.evaluationConcurrency, '评估配置记录缺少评估并发数'),
    };
  }

  private toJudgeModel(row: unknown): JudgeModelRecord {
    const data = this.readRecord(row, '评估模型记录格式不正确');
    return {
      id: this.readRequiredBigIntId(data.id, '评估模型记录缺少数据库 ID'),
      modelName: this.readRequiredString(data.modelName, '评估模型记录缺少模型名称'),
      providerCode: this.readRequiredString(data.providerCode, '评估模型记录缺少供应商编码'),
      modelId: this.readRequiredString(data.modelId, '评估模型记录缺少模型 ID'),
      modelType: this.readJudgeModelType(data.modelType),
      protocol: this.readJudgeModelProtocol(data.protocol),
      parameters: this.readOptionalRecord(data.parameters, '评估模型 parameters 不是 JSON 对象'),
      limits: {
        pricing: this.normalizePricing(this.readOptionalRecord(data.limits, '评估模型 limits 不是 JSON 对象').pricing),
      },
      enabled: this.readBoolean(data.enabled, '评估模型记录缺少启停状态'),
    };
  }

  private toJudgeProvider(row: unknown): JudgeProviderRecord {
    const data = this.readRecord(row, '评估模型供应商记录格式不正确');
    return {
      providerCode: this.readRequiredString(data.providerCode, '评估模型供应商记录缺少供应商编码'),
      providerName: this.readRequiredString(data.providerName, '评估模型供应商记录缺少供应商名称'),
      providerType: this.readJudgeProviderType(data.providerType),
      baseUrl: this.readRequiredString(data.baseUrl, '评估模型供应商记录缺少接口地址'),
      apiKey: this.readRequiredString(data.apiKey, '评估模型供应商记录缺少 API Key'),
      enabled: this.readBoolean(data.enabled, '评估模型供应商记录缺少启停状态'),
    };
  }

  private toRun(row: unknown): RunRecord {
    const data = this.readRecord(row, '执行批次记录格式不正确');
    const startAt = this.toIsoString(data.startedAt);
    const endAt = this.toIsoString(data.finishedAt);
    const durationMs = startAt && endAt ? new Date(endAt).getTime() - new Date(startAt).getTime() : undefined;
    return {
      runCode: this.readRequiredString(data.runCode, '执行批次记录缺少批次编码'),
      planCode: this.readRequiredString(data.planCode, '执行批次记录缺少计划编码'),
      appCode: this.readRequiredString(data.appCode, '执行批次记录缺少应用编码'),
      status: this.normalizeRunStatus(data.status),
      phase: this.normalizeRunPhase(data.phase),
      sequenceNo: this.optionalNumber(data.sequenceNo),
      totalCount: this.readNonNegativeInteger(data.totalCount, '执行批次记录缺少总数'),
      appCompletedCount: this.readNonNegativeInteger(data.appCompletedCount, '执行批次记录缺少应用完成数'),
      evalCompletedCount: this.readNonNegativeInteger(data.evalCompletedCount, '执行批次记录缺少评估完成数'),
      passCount: this.readNonNegativeInteger(data.passCount, '执行批次记录缺少通过数'),
      failCount: this.readNonNegativeInteger(data.failCount, '执行批次记录缺少失败数'),
      reviewCount: this.readNonNegativeInteger(data.reviewCount, '执行批次记录缺少待复核数'),
      avgScore: this.readNumberLike(data.avgScore, '执行批次记录缺少平均分'),
      normalInputTokens: this.readNonNegativeInteger(data.normalInputTokens, '执行批次记录缺少普通输入 Token 数'),
      cachedInputTokens: this.readNonNegativeInteger(data.cachedInputTokens, '执行批次记录缺少缓存命中 Token 数'),
      outputTokens: this.readNonNegativeInteger(data.outputTokens, '执行批次记录缺少输出 Token 数'),
      totalTokens: this.readNonNegativeInteger(data.totalTokens, '执行批次记录缺少总 Token 数'),
      normalInputCostAmount: this.optionalDecimalNumber(data.normalInputCostAmount),
      cachedInputCostAmount: this.optionalDecimalNumber(data.cachedInputCostAmount),
      outputCostAmount: this.optionalDecimalNumber(data.outputCostAmount),
      totalCostAmount: this.optionalDecimalNumber(data.totalCostAmount),
      currency: typeof data.currency === 'string' ? data.currency : undefined,
      costStatus: this.readRunCostStatus(data.costStatus),
      startAt,
      endAt,
      durationMs,
    };
  }

  private normalizeRunStatus(value: unknown): RunRecord['status'] {
    if (value === 'RUNNING' || value === 'CANCELLED' || value === 'FAILED') return value;
    if (value === 'COMPLETED') return value;
    throw new Error('执行批次记录状态非法');
  }

  private normalizeRunPhase(value: unknown): RunPhase {
    if (
      value === 'PENDING' ||
      value === 'APP_CALLING' ||
      value === 'EVALUATING' ||
      value === 'COSTING' ||
      value === 'COMPLETED' ||
      value === 'FAILED' ||
      value === 'CANCELLED'
    ) return value;
    throw new Error('执行批次记录阶段非法');
  }

  private normalizeResultPhaseStatus(value: unknown): ResultPhaseStatus {
    return this.readResultPhaseStatus(value, '执行结果阶段状态非法');
  }

  private readResultPhaseStatus(value: unknown, message: string): ResultPhaseStatus {
    const allowedStatuses: ResultPhaseStatus[] = ['PENDING', 'RUNNING', 'PASSED', 'FAILED', 'SKIPPED'];
    if (allowedStatuses.includes(value as ResultPhaseStatus)) return value as ResultPhaseStatus;
    throw new Error(message);
  }

  private normalizeManualResult(value: unknown): ResultRecord['manualResult'] {
    if (value === null) return null;
    if (value === 'PASS' || value === 'FAIL') return value;
    return undefined;
  }

  private readRunCostStatus(value: unknown): RunRecord['costStatus'] {
    if (value === 'CALCULATED' || value === 'NO_USAGE' || value === 'SKIPPED_NO_PRICE' || value === 'PARTIAL') return value;
    if (value === 'NOT_CALCULATED') return value;
    throw new Error('执行批次记录计费状态非法');
  }

  private normalizeJudgeCostStatus(value: unknown): JudgeCost['costStatus'] {
    const allowedStatuses: JudgeCost['costStatus'][] = ['CALCULATED', 'NO_USAGE', 'SKIPPED_NO_PRICE'];
    if (allowedStatuses.includes(value as JudgeCost['costStatus'])) return value as JudgeCost['costStatus'];
    throw new Error('评估调用计费状态非法');
  }

  private normalizeConcurrency(value: unknown) {
    const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
    if (!Number.isFinite(numberValue)) return DEFAULT_EXECUTION_CONCURRENCY;
    return Math.max(MIN_EXECUTION_CONCURRENCY, Math.min(MAX_EXECUTION_CONCURRENCY, Math.round(numberValue)));
  }

  private normalizePricing(value: unknown): ModelPricing | undefined {
    const record = this.asRecord(value);
    if (Object.keys(record).length === 0) return undefined;
    return {
      currency: 'CNY',
      unit: 'PER_MILLION_TOKENS',
      normalInputPrice: this.optionalDecimalNumber(record.normalInputPrice),
      cachedInputPrice: this.optionalDecimalNumber(record.cachedInputPrice),
      outputPrice: this.optionalDecimalNumber(record.outputPrice),
      cacheWriteInputPrice: this.optionalDecimalNumber(record.cacheWriteInputPrice),
    };
  }

  private optionalNumber(value: unknown): number | undefined {
    const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
    return Number.isFinite(numberValue) ? Math.round(numberValue) : undefined;
  }

  private optionalDecimalNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const numberValue = Number(typeof value === 'object' && 'toString' in value ? value.toString() : value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private readRecord(value: unknown, message: string): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    throw new Error(message);
  }

  private readRequiredString(value: unknown, message: string): string {
    if (typeof value === 'string' && value.trim()) return value;
    throw new Error(message);
  }

  private readString(value: unknown, message: string): string {
    if (typeof value === 'string') return value;
    throw new Error(message);
  }

  private readOptionalString(value: unknown, message: string): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    throw new Error(message);
  }

  private readRequiredBigIntId(value: unknown, message: string): string {
    if (typeof value === 'bigint' && value > 0n) return String(value);
    throw new Error(message);
  }

  private readBoolean(value: unknown, message: string): boolean {
    if (typeof value === 'boolean') return value;
    throw new Error(message);
  }

  private readNonNegativeInteger(value: unknown, message: string): number {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
    throw new Error(message);
  }

  private readNumberLike(value: unknown, message: string): number {
    const parsed = Number(typeof value === 'object' && value && 'toString' in value ? value.toString() : value);
    if (Number.isFinite(parsed)) return parsed;
    throw new Error(message);
  }

  private readOptionalRecord(value: unknown, message: string): Record<string, unknown> {
    if (value === null || value === undefined) return {};
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    throw new Error(message);
  }

  private readOptionalNullableRecord(value: unknown, message: string): Record<string, unknown> | undefined {
    if (value === null || value === undefined) return undefined;
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    throw new Error(message);
  }

  private readRequiredRecord(value: unknown, message: string): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    throw new Error(message);
  }

  private readConcurrency(value: unknown, message: string): number {
    if (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= MIN_EXECUTION_CONCURRENCY &&
      value <= MAX_EXECUTION_CONCURRENCY
    ) return value;
    throw new Error(message);
  }

  private readJudgeModelType(value: unknown): JudgeModelRecord['modelType'] {
    if (value === 'LLM' || value === 'EMBEDDING') return value;
    throw new Error('评估模型记录模型类型非法');
  }

  private readJudgeModelProtocol(value: unknown): string {
    if (
      value === 'OPENAI_CHAT_COMPLETIONS' ||
      value === 'OPENAI_EMBEDDINGS' ||
      value === 'DASHSCOPE_COMPATIBLE_CHAT' ||
      value === 'DASHSCOPE_COMPATIBLE_EMBEDDINGS' ||
      value === 'DEEPSEEK_CHAT_COMPLETIONS'
    ) return value;
    throw new Error('评估模型记录协议非法');
  }

  private readJudgeProviderType(value: unknown): ProviderInvocationKind {
    if (value === 'OPENAI_COMPATIBLE' || value === 'QWEN' || value === 'DEEPSEEK') return value;
    throw new Error('评估模型供应商类型非法');
  }

  private readCaseScope(value: unknown): ExecutionCaseRecord['caseScope'] {
    if (value === 'APP' || value === 'SYSTEM_PRESET') return value;
    throw new Error('执行用例记录作用域非法');
  }

  private readPlanStatus(value: unknown): ExecutionPlanRecord['status'] {
    if (value === 'ENABLED' || value === 'DISABLED') return value;
    throw new Error('执行计划记录状态非法');
  }

  private readPassStatus(value: unknown): ResultRecord['passStatus'] {
    if (value === 'PASS' || value === 'FAIL' || value === 'REVIEW') return value;
    throw new Error('执行结果通过状态非法');
  }

  private readJudgeCallStatus(value: unknown): JudgeCallRecord['status'] {
    if (value === 'SUCCEEDED' || value === 'FAILED') return value;
    throw new Error('评估调用状态非法');
  }

  private readOptionalNonNegativeInteger(value: unknown, message: string): number | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
    throw new Error(message);
  }

  private toJudgeCall(row: unknown): JudgeCallRecord {
    const data = this.readRecord(row, '评估调用记录格式不正确');
    return {
      callCode: this.readRequiredString(data.callCode, '评估调用记录缺少调用编码'),
      runCode: this.readRequiredString(data.runCode, '评估调用记录缺少批次编码'),
      resultId: this.readRequiredBigIntId(data.resultId, '评估调用记录缺少结果 ID'),
      appCode: this.readRequiredString(data.appCode, '评估调用记录缺少应用编码'),
      caseId: this.readRequiredBigIntId(data.caseId, '评估调用记录缺少用例 ID'),
      providerCode: this.readRequiredString(data.providerCode, '评估调用记录缺少供应商编码'),
      modelDbId: this.readRequiredBigIntId(data.modelDbId, '评估调用记录缺少模型数据库 ID'),
      modelId: this.readRequiredString(data.modelId, '评估调用记录缺少模型 ID'),
      protocol: this.readJudgeModelProtocol(data.protocol),
      promptText: this.readRequiredString(data.promptText, '评估调用记录缺少提示词'),
      requestJson: this.readRequiredRecord(data.requestJson, '评估调用记录缺少请求 JSON'),
      responseJson: this.readOptionalNullableRecord(data.responseJson, '评估调用响应 JSON 格式不正确'),
      rawResponseText: typeof data.rawResponseText === 'string' ? data.rawResponseText : undefined,
      rawUsageJson: this.readOptionalNullableRecord(data.rawUsageJson, '评估调用 usage JSON 格式不正确'),
      normalInputTokens: this.readOptionalNonNegativeInteger(data.normalInputTokens, '评估调用普通输入 Token 数非法'),
      cachedInputTokens: this.readOptionalNonNegativeInteger(data.cachedInputTokens, '评估调用缓存命中 Token 数非法'),
      outputTokens: this.readOptionalNonNegativeInteger(data.outputTokens, '评估调用输出 Token 数非法'),
      totalTokens: this.readOptionalNonNegativeInteger(data.totalTokens, '评估调用总 Token 数非法'),
      normalInputCostAmount: this.optionalDecimalNumber(data.normalInputCostAmount),
      cachedInputCostAmount: this.optionalDecimalNumber(data.cachedInputCostAmount),
      outputCostAmount: this.optionalDecimalNumber(data.outputCostAmount),
      totalCostAmount: this.optionalDecimalNumber(data.totalCostAmount),
      currency: typeof data.currency === 'string' ? data.currency : undefined,
      costStatus: this.normalizeJudgeCostStatus(data.costStatus),
      status: this.readJudgeCallStatus(data.status),
      errorCode: typeof data.errorCode === 'string' ? data.errorCode : undefined,
      errorMessage: typeof data.errorMessage === 'string' ? data.errorMessage : undefined,
      elapsedMs: this.readOptionalNonNegativeInteger(data.elapsedMs, '评估调用耗时非法'),
    };
  }

  private caseSnapshot(testCase: ExecutionCaseRecord): Record<string, unknown> {
    return {
      caseId: testCase.id,
      categoryId: testCase.categoryId,
      question: testCase.query,
      expectedAnswer: testCase.expectedBehavior,
      inputJson: testCase.inputJson,
      expectedJson: testCase.expectedJson,
    };
  }

  private toIsoString(value: unknown) {
    if (!value) return undefined;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
    }
    return undefined;
  }

  private toResult(row: unknown): ResultRecord {
    const data = this.readRecord(row, '执行结果记录格式不正确');
    const caseSnapshotJson = this.readRequiredRecord(data.caseSnapshotJson, '执行结果记录缺少用例快照 JSON');
    const requestJson = this.readRequiredRecord(data.requestJson, '执行结果记录缺少请求 JSON');
    const responseJson = this.readOptionalNullableRecord(data.responseJson, '执行结果响应 JSON 格式不正确');
    const snapshotFields = readCaseSnapshotFields(caseSnapshotJson);
    return {
      resultId: this.readRequiredBigIntId(data.id, '执行结果记录缺少数据库 ID'),
      runCode: this.readRequiredString(data.runCode, '执行结果记录缺少批次编码'),
      caseCode: this.readRequiredBigIntId(data.caseId, '执行结果记录缺少用例 ID'),
      categoryId: snapshotFields.categoryId,
      query: snapshotFields.query,
      expectedBehavior: snapshotFields.expectedBehavior,
      caseSnapshotJson,
      appStatus: this.normalizeResultPhaseStatus(data.appStatus),
      evaluationStatus: this.normalizeResultPhaseStatus(data.evaluationStatus),
      requestJson,
      responseJson,
      finalAnswer: this.readString(data.finalAnswer, '执行结果记录缺少最终回答'),
      finalScore: this.readNumberLike(data.finalScore, '执行结果记录缺少最终得分'),
      passStatus: this.readPassStatus(data.passStatus),
      failureReason: typeof data.failureReason === 'string' ? data.failureReason : undefined,
      problemType: typeof data.problemType === 'string' ? data.problemType : undefined,
      elapsedMs: this.readOptionalNonNegativeInteger(data.elapsedMs, '执行结果总耗时非法'),
      appElapsedMs: this.readOptionalNonNegativeInteger(data.appElapsedMs, '执行结果应用调用耗时非法'),
      judgeElapsedMs: this.readOptionalNonNegativeInteger(data.judgeElapsedMs, '执行结果评估耗时非法'),
      errorCode: typeof data.errorCode === 'string' ? data.errorCode : undefined,
    };
  }

  private toResultReview(row: unknown): Pick<ResultRecord, 'resultId' | 'manualResult' | 'reviewStatus' | 'reviewComment'> {
    const data = this.asRecord(row);
    return {
      resultId: String(data.resultId),
      manualResult: this.normalizeManualResult(data.manualResult),
      reviewStatus: 'REVIEWED',
      reviewComment: typeof data.reviewComment === 'string' ? data.reviewComment : undefined,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private asOptionalRecord(value: unknown): Record<string, unknown> | undefined {
    const record = this.asRecord(value);
    return Object.keys(record).length > 0 ? record : undefined;
  }

}

export class ExecutionService {
  private readonly database: ExecutionDataStore;
  private readonly fetchImpl: typeof fetch;
  private readonly aiInvocationClient: AiInvocationClient;
  private readonly backgroundRunner: BackgroundRunner;
  private readonly workerEnabled: boolean;
  private readonly activeRunCodes = new Set<string>();
  private readonly runCaseSnapshots = new Map<string, ExecutionCaseRecord[]>();
  private readonly runOrders = new Map<string, number>();
  private nextRunOrder = 0;
  private lastWorkerHeartbeatAt?: string;
  private lastRecoveryAt?: string;
  private lastRecoveryStatus: WorkerHealth['lastRecoveryStatus'] = 'IDLE';
  private recoveredRunCount = 0;
  private lastWorkerError?: string;

  constructor(deps: ExecutionServiceDeps = {}) {
    this.database = deps.database ?? new ExecutionDatabase();
    this.fetchImpl = deps.fetchImpl ?? fetch;
    this.aiInvocationClient = deps.aiInvocationClient ?? new AiInvocationClient({ fetchImpl: this.fetchImpl });
    this.backgroundRunner = deps.backgroundRunner ?? ((task) => {
      void task().catch((error) => {
        this.lastWorkerError = this.describeExecutionError(error);
      });
    });
    this.workerEnabled = deps.workerEnabled ?? true;
    const recoverOnStart = deps.recoverOnStart ?? (deps.database === undefined && this.workerEnabled);
    if (recoverOnStart) this.backgroundRunner(() => this.recoverRunningRuns());
  }

  /**
   * @author codex
   * Starts an execution run from the saved plan, current application protocol, and database cases.
   */
  async start(request: { planCode: string; appCode: string; caseCodes?: string[] }): Promise<RunRecord> {
    const plan = await this.getPlan(request.planCode);
    await this.getJudgeContext(request.appCode);
    const cases = await this.resolveCases(request, plan);
    if (cases.length > 0) await this.getApp(request.appCode);
    const runCode = await this.createRunCode();
    const startedAt = new Date().toISOString();
    const run: RunRecord = {
      runCode,
      planCode: request.planCode,
      appCode: request.appCode,
      status: cases.length === 0 ? 'COMPLETED' : 'RUNNING',
      phase: cases.length === 0 ? 'COMPLETED' : 'APP_CALLING',
      totalCount: cases.length,
      appCompletedCount: 0,
      evalCompletedCount: 0,
      passCount: 0,
      failCount: 0,
      reviewCount: 0,
      avgScore: 0,
      normalInputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costStatus: cases.length === 0 ? 'NO_USAGE' : 'NOT_CALCULATED',
      startAt: startedAt,
      endAt: cases.length === 0 ? startedAt : undefined,
      durationMs: cases.length === 0 ? 0 : undefined,
    };
    const nextRun = this.requirePersisted(await this.database.createRun(run), '执行批次保存失败');
    this.rememberRunOrder(nextRun.runCode);
    const placeholders = await Promise.all(cases.map(async (testCase, index) => {
      const pendingResult = this.pendingResult(nextRun.runCode, testCase, index);
      const savedResult = this.requirePersisted(await this.database.createResult(pendingResult, testCase), '执行结果保存失败');
      return this.enrichResult(savedResult);
    }));
    if (cases.length > 0) {
      this.runCaseSnapshots.set(nextRun.runCode, cases);
      this.scheduleRun(nextRun.runCode);
    }
    return this.attachRunSequence(nextRun);
  }

  async runList(query: { appCode?: string; planCode?: string }, page: { currentPage: number; linesPerPage: number }): Promise<PageResult<RunRecord>> {
    const all = this.withRunSequences(await this.getRunSource()).filter((run) => {
      const appMatched = !query.appCode || run.appCode === query.appCode;
      const planMatched = !query.planCode || run.planCode === query.planCode;
      return appMatched && planMatched;
    });
    const start = (page.currentPage - 1) * page.linesPerPage;
    return pageResult(all.slice(start, start + page.linesPerPage), page.currentPage, page.linesPerPage, all.length);
  }

  async resultList(runCode: string, page: { currentPage: number; linesPerPage: number }): Promise<PageResult<ResultRecord>> {
    const judgeCalls = await this.getJudgeCallSource(runCode);
    const judgeResultIds = new Set(judgeCalls.map((call) => call.resultId));
    const all = (await this.getResultSource(runCode)).map((result) => ({
      ...result,
      hasJudgeCall: result.hasJudgeCall || judgeResultIds.has(result.resultId),
    }));
    const start = (page.currentPage - 1) * page.linesPerPage;
    return pageResult(all.slice(start, start + page.linesPerPage), page.currentPage, page.linesPerPage, all.length);
  }

  async runDetail(runCode: string): Promise<RunRecord> {
    const run = await this.getRun(runCode);
    const plan = await this.getPlan(run.planCode);
    const sequencedRun = await this.attachRunSequence(run);
    return { ...sequencedRun, planName: plan.planName };
  }

  async runVersions(runCode: string): Promise<RunVersionRecord[]> {
    const selectedRun = await this.getRun(runCode);
    return this.withRunSequences(await this.getRunSource())
      .filter((run) => run.appCode === selectedRun.appCode && run.planCode === selectedRun.planCode)
      .sort((a, b) => (b.sequenceNo ?? 0) - (a.sequenceNo ?? 0))
      .map((run) => ({
        runCode: run.runCode,
        planCode: run.planCode,
        appCode: run.appCode,
        sequenceNo: run.sequenceNo,
        status: run.status,
        totalCount: run.totalCount,
        passCount: run.passCount,
        failCount: run.failCount,
        reviewCount: run.reviewCount,
        avgScore: run.avgScore,
        startAt: run.startAt,
        endAt: run.endAt,
        durationMs: run.durationMs,
      }));
  }

  async judgeCallDetail(resultId: string): Promise<JudgeCallRecord> {
    const call = await this.database.findJudgeCallByResult?.(resultId);
    if (!call) throw new Error('评估调用审计不存在');
    return call;
  }

  /**
   * @author codex
   * Reports worker recovery and activity state for service health diagnostics.
   */
  async getWorkerHealth(): Promise<WorkerHealth> {
    const runs = await this.getRunSource();
    return {
      enabled: this.workerEnabled,
      activeRunCount: this.activeRunCodes.size,
      runningRunCount: runs.filter((run) => run.status === 'RUNNING').length,
      lastHeartbeatAt: this.lastWorkerHeartbeatAt,
      lastRecoveryAt: this.lastRecoveryAt,
      lastRecoveryStatus: this.lastRecoveryStatus,
      recoveredRunCount: this.recoveredRunCount,
      lastError: this.lastWorkerError,
    };
  }

  async recalculateCost(runCode: string): Promise<RunRecord> {
    const run = await this.getRun(runCode);
    const calls = await this.getJudgeCallSource(runCode);
    const recalculatedCalls = await Promise.all(calls.map(async (call) => {
      const usage = normalizeJudgeUsage(call.rawUsageJson);
      const model = await this.getJudgeModel(call.modelDbId);
      const cost = calculateJudgeCost(usage, model?.limits?.pricing);
      const nextCall: JudgeCallRecord = {
        ...call,
        rawUsageJson: usage.rawUsage,
        normalInputTokens: usage.normalInputTokens,
        cachedInputTokens: usage.cachedInputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        normalInputCostAmount: cost.normalInputCostAmount,
        cachedInputCostAmount: cost.cachedInputCostAmount,
        outputCostAmount: cost.outputCostAmount,
        totalCostAmount: cost.totalCostAmount,
        currency: cost.currency,
        costStatus: cost.costStatus,
      };
      const saved = await this.database.updateJudgeCall?.(nextCall);
      return this.requirePersisted(saved, '评估调用审计更新失败');
    }));
    const results = await this.getResultSource(runCode);
    const savedRun = await this.persistRun(this.summarizeRun(run, results, run.status, run.phase, await this.calculateRunCostSummary(runCode)));
    const plan = await this.getPlan(savedRun.planCode);
    const sequencedRun = await this.attachRunSequence(savedRun);
    return { ...sequencedRun, planName: plan.planName };
  }

  async rerun(runCode: string): Promise<RunRecord> {
    const run = await this.getRun(runCode);
    if (run.status === 'RUNNING' || this.activeRunCodes.has(runCode)) {
      const plan = await this.getPlan(run.planCode);
      const sequencedRun = await this.attachRunSequence(run);
      return { ...sequencedRun, planName: plan.planName };
    }

    const plan = await this.getPlan(run.planCode);
    const existingResults = await this.getResultSource(runCode);
    const cases = existingResults.length > 0
      ? existingResults.map((result) => this.caseFromResultSnapshot(run, result))
      : await this.resolveCases({ appCode: run.appCode }, plan);
    if (cases.length === 0) {
      const emptyRun = await this.persistRun(this.summarizeRun(run, [], 'COMPLETED', 'COMPLETED', { costStatus: 'NO_USAGE' }));
      const sequencedRun = await this.attachRunSequence(emptyRun);
      return { ...sequencedRun, planName: plan.planName };
    }

    const resetResults = await Promise.all(cases.map(async (testCase, index) => {
      const previousResult = existingResults.find((result) => result.caseCode === testCase.id);
      const nextResult = this.resetResultForRerun(runCode, testCase, index, previousResult);
      return this.persistResultUpdate(nextResult, testCase);
    }));
    const startedAt = new Date().toISOString();
    const nextRun = await this.persistRun({
      ...run,
      status: 'RUNNING',
      phase: 'APP_CALLING',
      totalCount: resetResults.length,
      appCompletedCount: 0,
      evalCompletedCount: 0,
      passCount: 0,
      failCount: 0,
      reviewCount: 0,
      avgScore: 0,
      normalInputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      normalInputCostAmount: 0,
      cachedInputCostAmount: 0,
      outputCostAmount: 0,
      totalCostAmount: 0,
      currency: 'CNY',
      costStatus: 'NOT_CALCULATED',
      startAt: startedAt,
      endAt: undefined,
      durationMs: undefined,
    });
    this.runCaseSnapshots.set(runCode, cases);
    this.scheduleRun(runCode);
    const sequencedRun = await this.attachRunSequence(nextRun);
    return { ...sequencedRun, planName: plan.planName };
  }

  /**
   * @author codex
   * Re-runs judge evaluation for persisted results without calling the tested app again.
   */
  async reEvaluate(resultIds: string[]): Promise<ResultRecord[]> {
    if (resultIds.length === 0) throw new BadRequestException('resultIds 不能为空');

    const missingIds = [...resultIds];
    const targetResults: ResultRecord[] = [];
    const allRuns = await this.getRunSource();
    for (const run of allRuns) {
      if (missingIds.length === 0) break;
      const runResults = await this.getResultSource(run.runCode);
      for (const result of runResults) {
        const index = missingIds.indexOf(result.resultId);
        if (index >= 0) {
          targetResults.push(result);
          missingIds.splice(index, 1);
        }
      }
    }
    if (targetResults.length === 0) throw new BadRequestException('找不到对应的执行结果');

    const runCode = targetResults[0].runCode;
    const run = await this.getRun(runCode);
    const judgeContext = await this.getJudgeContext(run.appCode);

    const updatedResults: ResultRecord[] = [];
    for (const result of targetResults) {
      const testCase = this.caseFromResultSnapshot(run, result);
      const evaluated = await this.evaluateResultWithJudge(run, testCase, result, judgeContext);
      const saved = await this.persistResultUpdate(evaluated, testCase);
      updatedResults.push(saved);
      const runResults = await this.getResultSource(runCode);
      this.replaceResult(runResults, saved);
    }

    const allRunResults = await this.getResultSource(runCode);
    await this.persistRun(this.summarizeRun(run, allRunResults, run.status, run.phase));

    return updatedResults;
  }

  async cancel(runCode: string): Promise<RunRecord> {
    const run = await this.getRun(runCode);
    return this.persistRun({ ...run, status: 'CANCELLED' });
  }

  /**
   * @author codex
   * Uses eval_run as a durable queue: every RUNNING row can be resumed after service restart.
   */
  private async recoverRunningRuns() {
    this.lastRecoveryAt = new Date().toISOString();
    try {
      const runningRuns = (await this.getRunSource()).filter((run) => run.status === 'RUNNING');
      this.recoveredRunCount = runningRuns.length;
      for (const run of runningRuns) {
        if (this.activeRunCodes.has(run.runCode)) continue;
        this.activeRunCodes.add(run.runCode);
        this.touchWorkerHeartbeat();
        await this.processRunJob(run.runCode);
      }
      this.lastRecoveryStatus = 'SUCCEEDED';
    } catch (error) {
      this.lastRecoveryStatus = 'FAILED';
      this.lastWorkerError = this.describeExecutionError(error);
      throw error;
    }
  }

  private scheduleRun(runCode: string) {
    if (!this.workerEnabled || this.activeRunCodes.has(runCode)) return;
    this.activeRunCodes.add(runCode);
    this.backgroundRunner(() => this.processRunJob(runCode));
  }

  private async processRunJob(runCode: string) {
    let run: RunRecord | undefined;
    let currentResults: ResultRecord[] = [];
    try {
      this.touchWorkerHeartbeat();
      run = await this.getRun(runCode);
      if (run.status !== 'RUNNING') return;

      const plan = await this.getPlan(run.planCode);
      const cases = this.runCaseSnapshots.get(run.runCode) ?? (await this.resolveCases({ appCode: run.appCode }, plan));
      const results = await this.ensureRunResults(run, cases);
      currentResults = results;
      this.touchWorkerHeartbeat();

      if (run.phase !== 'EVALUATING' && run.phase !== 'COSTING') {
        const app = cases.length > 0 ? await this.getApp(run.appCode) : undefined;
        const appTasks = cases
          .map((testCase, index) => ({ testCase, index, result: this.findResult(results, testCase.id) }))
          .filter((item): item is { testCase: ExecutionCaseRecord; index: number; result: ResultRecord } =>
            item.result !== undefined && !this.isAppCompleted(item.result),
          );
        await this.runWithConcurrency(appTasks, this.resolveAppConcurrency(app), async ({ testCase, index, result }) => {
          const nextResult = await this.executeAppCall(run!.runCode, testCase, index, app, result);
          this.replaceResult(results, nextResult);
          await this.persistResultUpdate(nextResult, testCase);
          this.touchWorkerHeartbeat();
          await this.persistRun(this.summarizeRun(run!, results, 'RUNNING', 'APP_CALLING'));
        });
        run = await this.persistRun(this.summarizeRun(run, results, 'RUNNING', 'EVALUATING'));
        this.touchWorkerHeartbeat();
      }

      if (run.phase !== 'COSTING') {
        await this.evaluateCompletedAppResults(run, cases, results);
        run = await this.persistRun(this.summarizeRun(run, results, 'RUNNING', 'COSTING'));
        this.touchWorkerHeartbeat();
      }

      const costSummary = await this.calculateRunCostSummary(run.runCode);
      await this.persistRun(this.summarizeRun(run, results, 'COMPLETED', 'COMPLETED', costSummary));
    } catch (error) {
      if (!run) return;
      this.lastWorkerError = this.describeExecutionError(error);
      await this.persistRun(this.summarizeRun(run, currentResults, 'FAILED'));
    } finally {
      this.activeRunCodes.delete(runCode);
      this.runCaseSnapshots.delete(runCode);
    }
  }

  private touchWorkerHeartbeat() {
    this.lastWorkerHeartbeatAt = new Date().toISOString();
  }

  private async ensureRunResults(run: RunRecord, cases: ExecutionCaseRecord[]) {
    const results = await this.getResultSource(run.runCode);
    for (const [index, testCase] of cases.entries()) {
      if (this.findResult(results, testCase.id)) continue;
      const pendingResult = this.pendingResult(run.runCode, testCase, index);
      const savedResult = this.requirePersisted(await this.database.createResult(pendingResult, testCase), '执行结果保存失败');
      results.push(this.enrichResult(savedResult));
    }
    return results;
  }

  private pendingResult(runCode: string, testCase: ExecutionCaseRecord, index: number): ResultRecord {
    return {
      resultId: `${runCode}_RESULT_${index + 1}`,
      runCode,
      caseCode: testCase.id,
      query: testCase.query,
      expectedBehavior: testCase.expectedBehavior,
      caseSnapshotJson: this.caseSnapshot(testCase),
      requestJson: {},
      finalAnswer: '',
      finalScore: 0,
      passStatus: 'REVIEW',
      appStatus: 'PENDING',
      evaluationStatus: 'PENDING',
    };
  }

  private findResult(results: ResultRecord[], caseCode: string) {
    return results.find((result) => result.caseCode === caseCode);
  }

  private replaceResult(results: ResultRecord[], nextResult: ResultRecord) {
    const index = results.findIndex((result) => result.resultId === nextResult.resultId || result.caseCode === nextResult.caseCode);
    if (index >= 0) results[index] = nextResult;
    else results.push(nextResult);
  }

  private async persistResultUpdate(result: ResultRecord, testCase: ExecutionCaseRecord) {
    const saved = await this.database.updateResult?.(result, testCase);
    return this.enrichResult(this.requirePersisted(saved, '执行结果更新失败'));
  }

  private async executeAppCall(
    runCode: string,
    testCase: ExecutionCaseRecord,
    index: number,
    app: ExecutionAppRecord | undefined,
    currentResult: ResultRecord,
  ) {
    if (!app) {
      return {
        ...this.failedResult(runCode, testCase, index, 'APP_PROTOCOL_MISSING', '应用协议不存在，无法执行真实调用'),
        resultId: currentResult.resultId,
      };
    }

    const startedAt = Date.now();
    let requestMethod: ExecutionAppRecord['requestMethod'];
    try {
      requestMethod = readAppRequestMethod(app.requestMethod);
    } catch (error) {
      return {
        ...this.failedResult(
          runCode,
          testCase,
          index,
          'APP_PROTOCOL_INVALID',
          error instanceof Error ? error.message : '应用协议配置非法',
          Date.now() - startedAt,
        ),
        resultId: currentResult.resultId,
      };
    }

    const invokeUrlValidation = validateApplicationInvokeUrl(app.invokeUrl);
    if (!invokeUrlValidation.allowed) {
      return {
        ...this.failedResult(
          runCode,
          testCase,
          index,
          'APP_INVOKE_URL_BLOCKED',
          `被测应用调用地址不允许访问：${invokeUrlValidation.reason ?? '不符合当前运行环境策略'}`,
          Date.now() - startedAt,
        ),
        resultId: currentResult.resultId,
      };
    }

    try {
      const resolvedHeaders = this.renderTemplate(app.headerTemplate, this.caseTemplateData(testCase));
      const resolvedBody = this.renderTemplate(app.bodyTemplate, this.caseTemplateData(testCase));
      const requestHeaders = normalizeApplicationRequestHeaders(this.parseRequestJsonObject(resolvedHeaders, '请求头模板'));
      const requestJson = requestMethod === 'GET' ? {} : this.parseRequestJsonObject(resolvedBody, '请求体模板');
      const upstream = await this.fetchWithTimeout(app.invokeUrl, {
        method: requestMethod,
        headers: requestHeaders,
        body: requestMethod === 'GET' ? undefined : resolvedBody,
      });
      const rawText = await upstream.text();
      const responseJson = this.parseResponse(rawText, app.streamEnabled);
      const finalAnswer = String(this.readJsonPath(responseJson, app.adapterConfig.response.answerPath) ?? '');
      const assertionPassed = this.evaluateSuccessExpression(responseJson, app.adapterConfig.response.successExpression);
      const protocolPassed = upstream.ok && assertionPassed === true;
      if (!protocolPassed) {
        return {
          ...currentResult,
          requestJson,
          responseJson,
          finalAnswer,
          finalScore: 0,
          passStatus: 'FAIL' as const,
          failureReason: '应用接口调用未满足成功表达式',
          problemType: '接口调用失败',
          appStatus: 'FAILED' as const,
          evaluationStatus: 'SKIPPED' as const,
          elapsedMs: Date.now() - startedAt,
          appElapsedMs: Date.now() - startedAt,
          errorCode: `HTTP_${upstream.status}`,
        };
      }
      const elapsedMs = Date.now() - startedAt;
      return {
        ...currentResult,
        requestJson,
        responseJson,
        finalAnswer,
        finalScore: 0,
        passStatus: 'REVIEW' as const,
        failureReason: '接口调用完成，等待评估模型评分',
        problemType: undefined,
        appStatus: 'PASSED' as const,
        evaluationStatus: 'PENDING' as const,
        elapsedMs,
        appElapsedMs: elapsedMs,
        errorCode: undefined,
      };
    } catch (error) {
      return {
        ...this.failedResult(runCode, testCase, index, 'EXECUTION_CALL_FAILED', error instanceof Error ? error.message : '真实接口调用失败', Date.now() - startedAt),
        resultId: currentResult.resultId,
      };
    }
  }

  private async evaluateCompletedAppResults(run: RunRecord, cases: ExecutionCaseRecord[], results: ResultRecord[]) {
    const evaluableItems = cases
      .map((testCase, index) => ({ testCase, index, result: this.findResult(results, testCase.id) }))
      .filter((item): item is { testCase: ExecutionCaseRecord; index: number; result: ResultRecord } =>
        item.result !== undefined &&
        item.result.appStatus === 'PASSED' &&
        !this.isTerminalResultStatus(item.result.evaluationStatus),
      );
    if (evaluableItems.length === 0) return;

    let judgeContext: JudgeContext;
    try {
      judgeContext = await this.getJudgeContext(run.appCode);
    } catch (error) {
      const failureReason = this.describeExecutionError(error);
      for (const { testCase, index, result } of evaluableItems) {
        const failedResult = this.failedJudgeConfigResult(run.runCode, testCase, index, result, failureReason);
        this.replaceResult(results, failedResult);
        await this.persistResultUpdate(failedResult, testCase);
      }
      await this.persistRun(this.summarizeRun(run, results, 'RUNNING', 'EVALUATING'));
      return;
    }

    await this.runWithConcurrency(evaluableItems, this.resolveEvaluationConcurrency(judgeContext.config), async ({ testCase, result }) => {
      const evaluated = await this.evaluateResultWithJudge(run, testCase, result, judgeContext);
      this.replaceResult(results, evaluated);
      await this.persistResultUpdate(evaluated, testCase);
      await this.persistRun(this.summarizeRun(run, results, 'RUNNING', 'EVALUATING'));
    });
  }

  private failedJudgeConfigResult(
    runCode: string,
    testCase: ExecutionCaseRecord,
    index: number,
    currentResult: ResultRecord,
    failureReason: string,
  ): ResultRecord {
    return {
      ...this.failedResult(runCode, testCase, index, 'JUDGE_CONFIG_UNAVAILABLE', failureReason, currentResult.appElapsedMs ?? currentResult.elapsedMs ?? 0),
      resultId: currentResult.resultId,
      requestJson: currentResult.requestJson,
      responseJson: currentResult.responseJson,
      finalAnswer: currentResult.finalAnswer,
      appStatus: currentResult.appStatus,
      evaluationStatus: 'FAILED',
      problemType: '评估配置不可用',
      appElapsedMs: currentResult.appElapsedMs,
      judgeElapsedMs: 0,
    };
  }

  private summarizeRun(
    run: RunRecord,
    results: ResultRecord[],
    status: RunRecord['status'],
    phase?: RunPhase,
    costSummary?: Partial<RunRecord>,
  ): RunRecord {
    const countableResults = results.filter((result) => this.isCountableResult(result));
    const totalScore = countableResults.reduce((sum, result) => sum + result.finalScore, 0);
    const endAt = status === 'RUNNING' ? undefined : run.endAt ?? new Date().toISOString();
    return {
      ...run,
      status,
      phase: phase ?? run.phase,
      appCompletedCount: results.filter((result) => this.isTerminalResultStatus(result.appStatus)).length,
      evalCompletedCount: results.filter((result) => this.isTerminalResultStatus(result.evaluationStatus)).length,
      passCount: countableResults.filter((result) => result.passStatus === 'PASS').length,
      failCount: countableResults.filter((result) => result.passStatus === 'FAIL').length,
      reviewCount: countableResults.filter((result) => result.passStatus === 'REVIEW').length,
      avgScore: countableResults.length === 0 ? 0 : Math.round(totalScore / countableResults.length),
      ...costSummary,
      endAt,
      durationMs: run.startAt && endAt ? new Date(endAt).getTime() - new Date(run.startAt).getTime() : undefined,
    };
  }

  private isTerminalResultStatus(status: ResultPhaseStatus | undefined) {
    return status === 'PASSED' || status === 'FAILED' || status === 'SKIPPED';
  }

  private isAppCompleted(result: ResultRecord) {
    return this.isTerminalResultStatus(result.appStatus);
  }

  private isCountableResult(result: ResultRecord) {
    return this.isTerminalResultStatus(result.evaluationStatus);
  }

  private resolveAppConcurrency(app: ExecutionAppRecord | undefined) {
    return this.normalizeConcurrency(app?.adapterConfig.execution?.appConcurrency);
  }

  private resolveEvaluationConcurrency(config: EvaluationConfigRecord) {
    return this.normalizeConcurrency(config.evaluationConcurrency);
  }

  private normalizeConcurrency(value: unknown) {
    const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
    if (!Number.isFinite(numberValue)) return DEFAULT_EXECUTION_CONCURRENCY;
    return Math.max(MIN_EXECUTION_CONCURRENCY, Math.min(MAX_EXECUTION_CONCURRENCY, Math.round(numberValue)));
  }

  private async runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
    let nextIndex = 0;
    const workerCount = Math.min(concurrency, items.length);
    await Promise.all(Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        await worker(items[currentIndex]);
      }
    }));
  }

  private async persistJudgeCall(call: JudgeCallRecord) {
    const saved = await this.database.createJudgeCall?.(call);
    return this.requirePersisted(saved, '评估调用审计保存失败');
  }

  private async getJudgeCallSource(runCode: string) {
    return this.requirePersisted(await this.database.listJudgeCalls?.(runCode), '评估调用审计读取失败');
  }

  private resetResultForRerun(
    runCode: string,
    testCase: ExecutionCaseRecord,
    index: number,
    previousResult?: ResultRecord,
  ): ResultRecord {
    return {
      ...this.pendingResult(runCode, testCase, index),
      resultId: previousResult?.resultId ?? `${runCode}_RESULT_${index + 1}`,
      hasJudgeCall: false,
      manualResult: null,
      reviewStatus: 'PENDING',
      reviewComment: undefined,
    };
  }

  private caseFromResultSnapshot(run: RunRecord, result: ResultRecord): ExecutionCaseRecord {
    const snapshot = this.readRequiredSnapshotRecord(result.caseSnapshotJson, '执行结果快照缺少用例快照');
    const snapshotFields = readCaseSnapshotFields(snapshot);
    return {
      id: result.caseCode,
      appCode: run.appCode,
      categoryId: snapshotFields.categoryId,
      inputJson: this.readRequiredSnapshotRecord(snapshot.inputJson, '执行结果快照缺少请求输入'),
      expectedJson: this.readRequiredSnapshotRecord(snapshot.expectedJson, '执行结果快照缺少期望信息'),
      query: snapshotFields.query,
      expectedBehavior: snapshotFields.expectedBehavior,
      enabled: true,
    };
  }

  private readRequiredSnapshotRecord(value: unknown, message: string): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    throw new Error(message);
  }

  private async calculateRunCostSummary(runCode: string): Promise<Partial<RunRecord>> {
    const calls = await this.getJudgeCallSource(runCode);
    const totals = calls.reduce((current, call) => ({
      normalInputTokens: current.normalInputTokens + (call.normalInputTokens ?? 0),
      cachedInputTokens: current.cachedInputTokens + (call.cachedInputTokens ?? 0),
      outputTokens: current.outputTokens + (call.outputTokens ?? 0),
      totalTokens: current.totalTokens + (call.totalTokens ?? 0),
      normalInputCostAmount: this.addNullableAmount(current.normalInputCostAmount, call.normalInputCostAmount),
      cachedInputCostAmount: this.addNullableAmount(current.cachedInputCostAmount, call.cachedInputCostAmount),
      outputCostAmount: this.addNullableAmount(current.outputCostAmount, call.outputCostAmount),
      totalCostAmount: this.addNullableAmount(current.totalCostAmount, call.totalCostAmount),
    }), {
      normalInputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      normalInputCostAmount: 0 as number | null,
      cachedInputCostAmount: 0 as number | null,
      outputCostAmount: 0 as number | null,
      totalCostAmount: 0 as number | null,
    });
    return {
      ...totals,
      normalInputCostAmount: this.roundNullableAmount(totals.normalInputCostAmount),
      cachedInputCostAmount: this.roundNullableAmount(totals.cachedInputCostAmount),
      outputCostAmount: this.roundNullableAmount(totals.outputCostAmount),
      totalCostAmount: this.roundNullableAmount(totals.totalCostAmount),
      currency: calls.find((call) => call.currency)?.currency ?? 'CNY',
      costStatus: this.summarizeCostStatus(calls),
    };
  }

  private summarizeCostStatus(calls: JudgeCallRecord[]): RunRecord['costStatus'] {
    if (calls.length === 0) return 'NO_USAGE';
    const statuses = new Set(calls.map((call) => call.costStatus));
    if (statuses.size === 1) return statuses.has('CALCULATED') ? 'CALCULATED' : statuses.has('SKIPPED_NO_PRICE') ? 'SKIPPED_NO_PRICE' : 'NO_USAGE';
    if (statuses.has('SKIPPED_NO_PRICE')) return 'SKIPPED_NO_PRICE';
    if (statuses.has('NO_USAGE') && statuses.has('CALCULATED')) return 'PARTIAL';
    return 'NOT_CALCULATED';
  }

  private addNullableAmount(left: number | null, right: number | null | undefined) {
    if (left === null || right === null || right === undefined) return null;
    return left + right;
  }

  private roundNullableAmount(value: number | null) {
    return value === null ? null : Math.round(value * 1_000_000) / 1_000_000;
  }

  private caseSnapshot(testCase: ExecutionCaseRecord): Record<string, unknown> {
    return {
      caseId: testCase.id,
      categoryId: testCase.categoryId,
      question: testCase.query,
      expectedAnswer: testCase.expectedBehavior,
      inputJson: testCase.inputJson,
      expectedJson: testCase.expectedJson,
    };
  }

  private async resolveCases(request: { appCode: string; caseCodes?: string[] }, plan: ExecutionPlanRecord) {
    const caseFilter = this.readRequiredRecord(plan.caseFilter, '执行计划缺少用例筛选条件');
    const categoryCodes = this.stringArray(caseFilter.categoryCodes);
    const selectedCaseCodes = this.stringArray(caseFilter.selectedCaseCodes);
    const requestCaseCodes = this.stringArray(request.caseCodes);
    const requestedSet = new Set([...selectedCaseCodes, ...requestCaseCodes]);

    const subscriptions = await this.getSubscriptionSource(request.appCode);
    const subscribedCategoryIds = new Set(subscriptions.map(s => s.categoryId));

    return (await this.getCaseSource()).filter((testCase) => {
      const isSubscribedPreset = testCase.caseScope === 'SYSTEM_PRESET' && subscribedCategoryIds.has(testCase.categoryId);
      const appMatched = testCase.appCode === request.appCode || isSubscribedPreset;
      const enabledMatched = testCase.enabled;
      const categoryMatched = categoryCodes.length === 0 || categoryCodes.includes(testCase.categoryId);
      const selectedMatched = requestedSet.size === 0 || requestedSet.has(testCase.id);
      return appMatched && enabledMatched && categoryMatched && selectedMatched;
    });
  }

  private readRequiredRecord(value: unknown, message: string): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    throw new Error(message);
  }

  private failedResult(runCode: string, testCase: ExecutionCaseRecord, index: number, errorCode: string, failureReason: string, elapsedMs = 0): ResultRecord {
    return {
      resultId: `${runCode}_RESULT_${index + 1}`,
      runCode,
      caseCode: testCase.id,
      query: testCase.query,
      expectedBehavior: testCase.expectedBehavior,
      caseSnapshotJson: this.caseSnapshot(testCase),
      requestJson: {},
      responseJson: { error: failureReason },
      finalAnswer: '',
      finalScore: 0,
      passStatus: 'FAIL',
      failureReason,
      problemType: '接口调用失败',
      elapsedMs,
      appElapsedMs: elapsedMs,
      judgeElapsedMs: 0,
      appStatus: 'FAILED',
      evaluationStatus: 'SKIPPED',
      errorCode,
    };
  }

  private async evaluateResultWithJudge(
    run: RunRecord,
    testCase: ExecutionCaseRecord,
    result: ResultRecord,
    judgeContext: JudgeContext,
  ): Promise<ResultRecord> {
    const evaluated = await this.evaluateAnswerWithJudge(
      judgeContext,
      testCase,
      result.finalAnswer,
      { runCode: run.runCode, resultId: result.resultId, appCode: run.appCode },
    );
    await this.persistJudgeCall(evaluated.call);
    return {
      ...result,
      finalScore: evaluated.score.finalScore,
      passStatus: evaluated.score.passStatus,
      failureReason: evaluated.score.failureReason,
      problemType: evaluated.score.problemType,
      errorCode: evaluated.score.errorCode,
      evaluationStatus: evaluated.score.errorCode ? 'FAILED' : 'PASSED',
      judgeElapsedMs: evaluated.call.elapsedMs,
      elapsedMs: (result.appElapsedMs ?? result.elapsedMs ?? 0) + (evaluated.call.elapsedMs ?? 0),
      hasJudgeCall: true,
    };
  }

  private async evaluateAnswerWithJudge(
    judgeContext: JudgeContext,
    testCase: ExecutionCaseRecord,
    finalAnswer: string,
    context: { runCode: string; resultId: string; appCode: string },
  ): Promise<JudgeEvaluationResult> {
    const judgeTimeoutMs = this.resolveJudgeTimeoutMs(judgeContext.model.parameters, finalAnswer);
    const invocationRequest = this.buildJudgeInvocationRequest(judgeContext, testCase, finalAnswer, judgeTimeoutMs);
    const requestJson = toInvocationAuditJson(invocationRequest);
    const startedAt = Date.now();
    const baseCall = (): Omit<JudgeCallRecord, 'status' | 'costStatus'> => ({
      callCode: createOpaqueId('judge'),
      runCode: context.runCode,
      resultId: context.resultId,
      appCode: context.appCode,
      caseId: testCase.id,
      providerCode: judgeContext.provider.providerCode,
      modelDbId: judgeContext.model.id,
      modelId: judgeContext.model.modelId,
      protocol: judgeContext.model.protocol,
      promptText: judgeContext.config.effectivePrompt,
      requestJson,
    });
    try {
      const invocationResult = await this.aiInvocationClient.invokeChat({
        connection: {
          baseUrl: judgeContext.provider.baseUrl,
          apiKey: judgeContext.provider.apiKey,
        },
        request: invocationRequest,
      });
      if (invocationResult.status !== 'SUCCEEDED') {
        throw new JudgeInvocationError(invocationResult.errorCode ?? 'JUDGE_EVALUATION_FAILED', invocationResult.errorMessage ?? '评估模型调用失败');
      }
      const payload = invocationResult.responseJson ?? {};
      const content = invocationResult.content ?? this.extractJudgeMessageContent(payload);
      const usage = normalizeJudgeUsage(invocationResult.usage?.rawUsage ?? payload.usage);
      const cost = calculateJudgeCost(usage, judgeContext.model.limits?.pricing);
      return {
        score: this.parseJudgeResult(content),
        call: {
          ...baseCall(),
          responseJson: payload,
          rawResponseText: invocationResult.rawResponseText,
          rawUsageJson: usage.rawUsage,
          normalInputTokens: usage.normalInputTokens,
          cachedInputTokens: usage.cachedInputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
          normalInputCostAmount: cost.normalInputCostAmount,
          cachedInputCostAmount: cost.cachedInputCostAmount,
          outputCostAmount: cost.outputCostAmount,
          totalCostAmount: cost.totalCostAmount,
          currency: cost.currency,
          costStatus: cost.costStatus,
          status: 'SUCCEEDED',
          elapsedMs: invocationResult.elapsedMs,
        },
      };
    } catch (error) {
      const failureReason = this.describeJudgeFailure(error, judgeTimeoutMs);
      const errorCode = error instanceof JudgeInvocationError ? error.code : 'JUDGE_EVALUATION_FAILED';
      return {
        score: {
          finalScore: 0,
          passStatus: 'FAIL',
          failureReason,
          problemType: '评估调用失败',
          errorCode,
        },
        call: {
          ...baseCall(),
          costStatus: 'NO_USAGE',
          status: 'FAILED',
          errorCode,
          errorMessage: failureReason,
          elapsedMs: Date.now() - startedAt,
        },
      };
    }
  }

  private buildJudgeInvocationRequest(
    judgeContext: JudgeContext,
    testCase: ExecutionCaseRecord,
    finalAnswer: string,
    timeoutMs: number,
  ): ModelInvocationRequest {
    const parameters = judgeContext.model.parameters;
    return {
      traceId: `${testCase.id}:${Date.now()}`,
      providerCode: judgeContext.provider.providerCode,
      providerKind: this.toInvocationProviderKind(judgeContext.provider.providerType),
      modelId: judgeContext.model.modelId,
      protocol: judgeContext.model.protocol === 'DASHSCOPE_COMPATIBLE_CHAT' ? 'DASHSCOPE_COMPATIBLE_CHAT' : 'OPENAI_COMPATIBLE',
      messages: [
        { role: 'system', content: judgeContext.config.effectivePrompt },
        {
          role: 'user',
          content: JSON.stringify({
            caseId: testCase.id,
            problemCategory: testCase.categoryId,
            question: testCase.query,
            expectedAnswer: testCase.expectedBehavior,
            actualAnswer: finalAnswer,
          }),
        },
      ],
      stream: false,
      temperature: typeof parameters.temperature === 'number' ? parameters.temperature : 0,
      maxTokens: this.resolveJudgeMaxOutputTokens(parameters),
      responseFormat: parameters.jsonMode === true ? 'json_object' : 'text',
      topP: typeof parameters.topP === 'number' ? parameters.topP : undefined,
      enableThinking: this.shouldDisableJudgeThinking(judgeContext) ? false : undefined,
      reasoningEffort: this.readReasoningEffort(parameters.reasoningEffort),
      timeoutMs,
    };
  }

  private toInvocationProviderKind(providerType: string): ProviderInvocationKind | undefined {
    if (providerType === 'OPENAI_COMPATIBLE' || providerType === 'QWEN' || providerType === 'DEEPSEEK') return providerType;
    return undefined;
  }

  /**
   * @author codex
   * Keeps untyped model JSON from becoming raw provider reasoning payloads.
   */
  private readReasoningEffort(value: unknown): ModelInvocationRequest['reasoningEffort'] {
    if (value === 'low' || value === 'medium' || value === 'high' || value === 'max') return value;
    return undefined;
  }

  private shouldDisableJudgeThinking(judgeContext: JudgeContext) {
    return judgeContext.provider.providerType === 'QWEN' ||
      judgeContext.provider.providerType === 'DEEPSEEK' ||
      judgeContext.model.protocol === 'DASHSCOPE_COMPATIBLE_CHAT';
  }

  /**
   * @author codex
   * Keeps judge requests bounded independently from the app protocol timeout.
   */
  private resolveJudgeTimeoutMs(parameters: Record<string, unknown>, finalAnswer: string) {
    const explicitTimeout = parameters.judgeTimeoutMs ?? parameters.timeoutMs;
    if (explicitTimeout !== undefined) {
      return this.clampNumberParameter(explicitTimeout, DEFAULT_JUDGE_TIMEOUT_MS, MIN_JUDGE_TIMEOUT_MS, MAX_JUDGE_TIMEOUT_MS);
    }
    const contentSteps = Math.max(0, Math.ceil(finalAnswer.length / JUDGE_TIMEOUT_STEP_CHARS) - 1);
    return Math.min(MAX_JUDGE_TIMEOUT_MS, DEFAULT_JUDGE_TIMEOUT_MS + contentSteps * JUDGE_TIMEOUT_STEP_MS);
  }

  private resolveJudgeMaxOutputTokens(parameters: Record<string, unknown>) {
    return this.clampNumberParameter(
      parameters.maxOutputTokens,
      DEFAULT_JUDGE_MAX_OUTPUT_TOKENS,
      MIN_JUDGE_MAX_OUTPUT_TOKENS,
      MAX_JUDGE_MAX_OUTPUT_TOKENS,
    );
  }

  private clampNumberParameter(value: unknown, fallback: number, min: number, max: number) {
    const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (!Number.isFinite(numberValue)) return fallback;
    return Math.max(min, Math.min(max, Math.round(numberValue)));
  }

  private describeJudgeFailure(error: unknown, timeoutMs: number) {
    if (error instanceof JudgeInvocationError) {
      if (error.code === 'PROVIDER_TIMEOUT') {
        return `评估模型调用超时：已等待 ${Math.round(timeoutMs / 1000)} 秒，评估模型未返回结果`;
      }
      return `评估模型调用失败：${error.message}`;
    }
    if (this.isAbortError(error)) {
      return `评估模型调用超时：已等待 ${Math.round(timeoutMs / 1000)} 秒，评估模型未返回结果`;
    }
    const message = error instanceof Error ? error.message : '评估模型调用失败';
    return `评估模型调用失败：${message}`;
  }

  private describeExecutionError(error: unknown) {
    return error instanceof Error ? error.message : '执行配置不可用';
  }

  private isAbortError(error: unknown) {
    if (!error || typeof error !== 'object') return false;
    const data = error as { name?: unknown; message?: unknown };
    return data.name === 'AbortError' || (typeof data.message === 'string' && data.message.toLowerCase().includes('aborted'));
  }

  private extractJudgeMessageContent(payload: Record<string, unknown>) {
    const content =
      this.readObjectPath(payload, 'choices.0.message.content') ??
      this.readObjectPath(payload, 'choices.0.delta.content') ??
      this.readObjectPath(payload, 'output.text') ??
      this.readObjectPath(payload, 'content');
    if (typeof content !== 'string' || !content.trim()) throw new Error('评估模型未返回有效内容');
    return content;
  }

  private parseJudgeResult(content: string): EvaluationScore {
    const jsonText = content.match(/\{[\s\S]*\}/u)?.[0] ?? content;
    const parsed = this.parseRequiredJsonObject(jsonText, '评估模型返回的评分');
    const passStatus = this.readJudgeStatus(parsed.passStatus);
    const score = this.readJudgeScore(parsed.score);
    const reason = this.readJudgeReason(parsed.reason);
    return {
      finalScore: Math.max(0, Math.min(100, Math.round(score))),
      passStatus,
      failureReason: reason,
      problemType: typeof parsed.problemType === 'string' ? parsed.problemType : undefined,
    };
  }

  /**
   * @author codex
   * Requires the judge model to return the current scoring contract instead of silently scoring malformed JSON.
   */
  private readJudgeStatus(value: unknown): EvaluationScore['passStatus'] {
    if (value === 'PASS' || value === 'FAIL' || value === 'REVIEW') return value;
    throw new Error('评估模型返回的评分缺少有效 passStatus');
  }

  private readJudgeScore(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    throw new Error('评估模型返回的评分缺少有效 score');
  }

  private readJudgeReason(value: unknown): string {
    if (typeof value === 'string' && value.trim()) return value;
    throw new Error('评估模型返回的评分缺少有效 reason');
  }

  private async getCaseSource() {
    const databaseCases = this.requirePersisted(await this.database.listCases(), '执行用例读取失败');
    return databaseCases;
  }

  private async getSubscriptionSource(appCode: string) {
    if (typeof this.database.listSubscriptions !== 'function') {
      throw new Error('执行数据源缺少预置分类订阅读取能力');
    }
    return this.requirePersisted(await this.database.listSubscriptions(appCode), '预置分类订阅读取失败');
  }

  private async getRunSource() {
    const databaseRuns = this.requirePersisted(await this.database.listRuns(), '执行批次读取失败');
    [...databaseRuns].reverse().forEach((run) => this.rememberRunOrder(run.runCode));
    return databaseRuns;
  }

  private async getResultSource(runCode: string) {
    const databaseResults = this.requirePersisted(await this.database.listResults(runCode), '执行结果读取失败');
    return databaseResults.map((result) => this.enrichResult(result));
  }

  private async getPlan(planCode: string) {
    return this.requirePersisted(await this.database.findPlan?.(planCode), '执行计划不存在');
  }

  private async getApp(appCode: string) {
    return this.requirePersisted(await this.database.findApp?.(appCode), '应用协议不存在');
  }

  private async getJudgeContext(appCode: string): Promise<JudgeContext> {
    const config = await this.getEvaluationConfig(appCode);
    if (!config?.modelId) {
      throw new BadRequestException('请先配置可用的评估模型');
    }
    const model = await this.getJudgeModel(config.modelId);
    if (!model || !model.enabled || model.modelType !== 'LLM') {
      throw new BadRequestException('评估模型不可用');
    }
    const provider = await this.getJudgeProvider(model.providerCode);
    if (!provider || !provider.enabled || !provider.baseUrl || !provider.apiKey) {
      throw new BadRequestException('评估模型供应商不可用');
    }
    return { config, model, provider };
  }

  private async getEvaluationConfig(appCode: string) {
    return await this.database.findEvaluationConfig?.(appCode) ?? null;
  }

  private async getJudgeModel(modelId: string) {
    return await this.database.findJudgeModel?.(modelId) ?? null;
  }

  private async getJudgeProvider(providerCode: string) {
    return await this.database.findJudgeProvider?.(providerCode) ?? null;
  }

  private async getRun(runCode: string) {
    const run = await this.database.findRun(runCode);
    if (!run) throw new Error('执行批次不存在');
    this.rememberRunOrder(run.runCode);
    return run;
  }

  /**
   * @author codex
   * Computes a human-readable per-plan execution order from persisted run times.
   */
  private withRunSequences(runs: RunRecord[]): RunRecord[] {
    const sortedRuns = [...runs].sort((a, b) => {
      const diff = this.readRunTime(a) - this.readRunTime(b);
      if (diff !== 0) return diff;
      const orderDiff = this.readRunOrder(a) - this.readRunOrder(b);
      return orderDiff === 0 ? a.runCode.localeCompare(b.runCode) : orderDiff;
    });
    const counters = new Map<string, number>();
    const sequenceMap = new Map<string, number>();

    sortedRuns.forEach((run) => {
      const key = `${run.appCode}:${run.planCode}`;
      const nextSequence = (counters.get(key) ?? 0) + 1;
      counters.set(key, nextSequence);
      sequenceMap.set(run.runCode, nextSequence);
    });

    return runs.map((run) => ({
      ...run,
      sequenceNo: sequenceMap.get(run.runCode),
    }));
  }

  private readRunTime(run: RunRecord): number {
    const timeText = run.startAt ?? run.endAt;
    const time = timeText ? new Date(timeText).getTime() : Number.NaN;
    return Number.isFinite(time) ? time : 0;
  }

  private rememberRunOrder(runCode: string) {
    if (this.runOrders.has(runCode)) return;
    this.runOrders.set(runCode, this.nextRunOrder);
    this.nextRunOrder += 1;
  }

  private readRunOrder(run: RunRecord): number {
    return this.runOrders.get(run.runCode) ?? Number.MAX_SAFE_INTEGER;
  }

  private async attachRunSequence(run: RunRecord): Promise<RunRecord> {
    const sequencedRun = this.withRunSequences(await this.getRunSource())
      .find((item) => item.runCode === run.runCode);
    return sequencedRun ?? run;
  }

  /**
   * @author codex
   * Generates non-guessable execution run identifiers without plan codes or timestamps.
   */
  private async createRunCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const runCode = createOpaqueId('run');
      const existingRun = await this.database.findRun(runCode);
      if (!existingRun) return runCode;
    }
    throw new Error('执行批次编码生成失败，请重试');
  }

  private async persistRun(run: RunRecord) {
    const saved = await this.database.updateRun(run);
    const next = this.requirePersisted(saved, '执行批次更新失败');
    this.rememberRunOrder(next.runCode);
    return next;
  }

  private requirePersisted<T>(value: T | null | undefined, message: string): T {
    if (!value) throw new Error(message);
    return value;
  }

  private enrichResult(result: ResultRecord): ResultRecord {
    const snapshot = this.readRequiredRecord(result.caseSnapshotJson, '执行结果快照缺少用例快照');
    const snapshotFields = readCaseSnapshotFields(snapshot);
    return {
      ...result,
      categoryId: snapshotFields.categoryId,
      query: snapshotFields.query,
      expectedBehavior: snapshotFields.expectedBehavior,
    };
  }

  private caseTemplateData(testCase: ExecutionCaseRecord) {
    return {
      case: {
        id: testCase.id,
        input: testCase.inputJson,
      },
    };
  }

  private renderTemplate(template: string, data: Record<string, unknown>) {
    return template.replace(/\{\{([^}]+)}}/g, (_, rawPath: string) => {
      const path = rawPath.trim();
      return String(this.readObjectPath(data, path) ?? '');
    });
  }

  private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs = DEFAULT_APP_PROTOCOL_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await this.fetchImpl(url, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseResponse(text: string, streamEnabled: boolean): Record<string, unknown> {
    const eventStreamResponse = this.parseServerSentEvents(text);
    if (eventStreamResponse) return eventStreamResponse;
    return this.parseRequiredJsonObject(text, '应用响应');
  }

  private parseServerSentEvents(text: string): Record<string, unknown> | null {
    const chunks = text
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .map((line) => line.match(/^data:\s*(.*)$/u)?.[1]?.trim() ?? '')
      .filter((line) => line && line !== '[DONE]');
    if (chunks.length === 0) return null;

    const parsedChunks = chunks.map((chunk) => this.parseRequiredJsonObject(chunk, '流式响应事件'));
    const merged = Object.assign({}, ...parsedChunks);
    const content = parsedChunks
      .map((chunk) => {
        const type = typeof chunk.type === 'string' ? chunk.type : 'answer';
        return type === 'answer' && typeof chunk.content === 'string' ? chunk.content : '';
      })
      .join('');

    return {
      ...merged,
      rawText: text,
      chunks: parsedChunks,
      ...(content ? { content } : {}),
    };
  }

  private parseRequiredJsonObject(text: string, label: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`${label}不是合法 JSON 对象`);
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      if (error instanceof Error && error.message === `${label}不是合法 JSON 对象`) throw error;
      throw new Error(`${label}不是合法 JSON 对象`);
    }
  }

  private parseRequestJsonObject(text: string, label: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`${label}不是合法 JSON 对象`);
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      if (error instanceof Error && error.message === `${label}不是合法 JSON 对象`) throw error;
      throw new Error(`${label}不是合法 JSON 对象`);
    }
  }

  private readJsonPath(data: Record<string, unknown>, path: string) {
    const normalizedPath = path.replace(/^\$\./, '');
    return this.readObjectPath(data, normalizedPath);
  }

  private readObjectPath(data: Record<string, unknown>, path: string) {
    return path.split('.').reduce<unknown>((current, key) => {
      if (!current || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[key];
    }, data);
  }

  private evaluateSuccessExpression(data: Record<string, unknown>, expression: string): boolean {
    const normalized = expression.trim();
    if (!normalized) return true;
    const [path, expectedRaw] = normalized.split('==').map((item) => item.trim());
    if (!path || expectedRaw === undefined) return false;
    const expected = expectedRaw.replace(/^['"]|['"]$/g, '');
    const actual = this.readJsonPath(data, path);
    if (actual === undefined || actual === null) return false;
    return String(actual) === expected;
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }
}
