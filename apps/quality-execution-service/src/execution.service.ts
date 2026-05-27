/**
 * 执行服务：按计划筛选用例、调用应用协议并持久化真实执行结果
 * @author codex
 */
import { randomBytes } from 'node:crypto';
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
  caseName?: string;
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
  caseName: string;
  appCode: string;
  caseScope?: 'APP' | 'SYSTEM_PRESET';
  categoryId: string;
  riskLevel: string;
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
  requestMethod: 'GET' | 'POST' | 'PUT' | 'PATCH';
  invokeUrl: string;
  authType: 'NONE' | 'API_KEY' | 'BEARER_TOKEN' | 'BASIC';
  authConfig?: Record<string, unknown>;
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
  providerType: string;
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
  listSubscriptions?(appCode: string): Promise<Array<{ appCode: string; categoryId: string }> | null>;
};

type BackgroundRunner = (task: () => Promise<void>) => void;

interface ExecutionServiceDeps {
  database?: ExecutionDataStore;
  fetchImpl?: typeof fetch;
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

const DEFAULT_HEADER_TEMPLATE = '{\n  "Content-Type": "application/json"\n}';
const DEFAULT_BODY_TEMPLATE = '{\n  "query": "{{case.query}}"\n}';
const DEFAULT_ANSWER_PATH = '$.content';
const DEFAULT_SUCCESS_EXPRESSION = '$.code == 0';
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

function asPlainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNestedString(source: Record<string, unknown>, path: string[]): string | undefined {
  let current: unknown = source;
  for (const key of path) {
    current = asPlainRecord(current)[key];
  }
  return readString(current);
}

function readCaseSnapshotFields(
  caseSnapshotJson?: Record<string, unknown>,
  requestJson?: Record<string, unknown>,
) {
  const snapshot = caseSnapshotJson ?? {};
  return {
    caseName: readString(snapshot.caseName),
    categoryId: readString(snapshot.categoryId),
    query: readString(snapshot.question) ?? readNestedString(snapshot, ['inputJson', 'query']) ?? readString(requestJson?.query),
    expectedBehavior: readString(snapshot.expectedAnswer) ?? readNestedString(snapshot, ['expectedJson', 'expectedBehavior']),
  };
}

class ExecutionDatabase implements ExecutionDataStore {
  private readonly prismaPromise = this.createClient();

  /**
   * @author codex
   * Persists execution runs and results in MySQL so history never comes from demo fixtures.
   */
  async listCases(): Promise<ExecutionCaseRecord[] | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const rows = await prisma.evalCase.findMany({ orderBy: { id: 'asc' } });
    return rows.map((row) => this.toCase(row));
  }

  async listSubscriptions(appCode: string): Promise<Array<{ appCode: string; categoryId: string }> | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const rows = (await prisma.appPresetCategory.findMany({ where: { appCode }, orderBy: { id: 'asc' } })) as Array<{ appCode: unknown; categoryId: unknown }>;
    return rows.map((row) => ({
      appCode: String(row.appCode),
      categoryId: String(row.categoryId),
    }));
  }

  async findPlan(planCode: string): Promise<ExecutionPlanRecord | null | undefined> {
    const prisma = await this.prismaPromise;
    if (!prisma) return undefined;
    const row = await prisma.evalPlan.findUnique({ where: { planCode } });
    return row ? this.toPlan(row) : null;
  }

  async findApp(appCode: string): Promise<ExecutionAppRecord | null | undefined> {
    const prisma = await this.prismaPromise;
    if (!prisma) return undefined;
    const row = await prisma.aiApp.findUnique({ where: { appCode } });
    return row ? this.toApp(row) : null;
  }

  async findEvaluationConfig(appCode: string): Promise<EvaluationConfigRecord | null | undefined> {
    const prisma = await this.prismaPromise;
    if (!prisma) return undefined;
    const row = await prisma.appEvaluationConfig.findUnique({ where: { appCode } });
    return row ? this.toEvaluationConfig(row) : null;
  }

  async findJudgeModel(modelId: string): Promise<JudgeModelRecord | null | undefined> {
    const prisma = await this.prismaPromise;
    if (!prisma) return undefined;
    const row = await prisma.aiModel.findUnique({ where: { id: BigInt(modelId) } });
    return row ? this.toJudgeModel(row) : null;
  }

  async findJudgeProvider(providerCode: string): Promise<JudgeProviderRecord | null | undefined> {
    const prisma = await this.prismaPromise;
    if (!prisma) return undefined;
    const row = await prisma.aiProvider.findUnique({ where: { providerCode } });
    return row ? this.toJudgeProvider(row) : null;
  }

  async listRuns(): Promise<RunRecord[] | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const rows = await prisma.evalRun.findMany({ orderBy: { id: 'desc' } });
    return rows.map((row) => this.toRun(row));
  }

  async findRun(runCode: string): Promise<RunRecord | null | undefined> {
    const prisma = await this.prismaPromise;
    if (!prisma) return undefined;
    const row = await prisma.evalRun.findUnique({ where: { runCode } });
    return row ? this.toRun(row) : null;
  }

  async createRun(run: RunRecord): Promise<RunRecord | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const startedAt = run.startAt ? new Date(run.startAt) : new Date();
    const finishedAt = run.status === 'RUNNING' ? null : run.endAt ? new Date(run.endAt) : new Date();
    const saved = await prisma.evalRun.create({
      data: {
        runCode: run.runCode,
        planCode: run.planCode,
        appCode: run.appCode,
        runName: run.runCode,
        sequenceNo: run.sequenceNo ?? null,
        status: run.status,
        phase: run.phase ?? (run.status === 'RUNNING' ? 'APP_CALLING' : 'COMPLETED'),
        totalCount: run.totalCount,
        appCompletedCount: run.appCompletedCount ?? 0,
        evalCompletedCount: run.evalCompletedCount ?? 0,
        passCount: run.passCount,
        failCount: run.failCount,
        reviewCount: run.reviewCount,
        warningCount: 0,
        blockedCount: 0,
        avgScore: run.avgScore,
        normalInputTokens: run.normalInputTokens ?? 0,
        cachedInputTokens: run.cachedInputTokens ?? 0,
        outputTokens: run.outputTokens ?? 0,
        totalTokens: run.totalTokens ?? 0,
        normalInputCostAmount: run.normalInputCostAmount ?? null,
        cachedInputCostAmount: run.cachedInputCostAmount ?? null,
        outputCostAmount: run.outputCostAmount ?? null,
        totalCostAmount: run.totalCostAmount ?? null,
        currency: run.currency ?? null,
        costStatus: run.costStatus ?? 'NOT_CALCULATED',
        costCalculatedAt: run.costStatus === 'CALCULATED' ? new Date() : null,
        startedAt,
        finishedAt,
      },
    });
    return this.toRun(saved);
  }

  async updateRun(run: RunRecord): Promise<RunRecord | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const finishedAt = run.status === 'RUNNING' ? null : run.endAt ? new Date(run.endAt) : new Date();
    const saved = await prisma.evalRun.update({
      where: { runCode: run.runCode },
      data: {
        status: run.status,
        phase: run.phase ?? (run.status === 'RUNNING' ? 'APP_CALLING' : 'COMPLETED'),
        totalCount: run.totalCount,
        appCompletedCount: run.appCompletedCount ?? 0,
        evalCompletedCount: run.evalCompletedCount ?? 0,
        passCount: run.passCount,
        failCount: run.failCount,
        reviewCount: run.reviewCount,
        avgScore: run.avgScore,
        normalInputTokens: run.normalInputTokens ?? 0,
        cachedInputTokens: run.cachedInputTokens ?? 0,
        outputTokens: run.outputTokens ?? 0,
        totalTokens: run.totalTokens ?? 0,
        normalInputCostAmount: run.normalInputCostAmount ?? null,
        cachedInputCostAmount: run.cachedInputCostAmount ?? null,
        outputCostAmount: run.outputCostAmount ?? null,
        totalCostAmount: run.totalCostAmount ?? null,
        currency: run.currency ?? null,
        costStatus: run.costStatus ?? 'NOT_CALCULATED',
        costCalculatedAt: run.costStatus && run.costStatus !== 'NOT_CALCULATED' ? new Date() : null,
        finishedAt,
      },
    });
    return this.toRun(saved);
  }

  async createResult(result: ResultRecord, testCase: ExecutionCaseRecord): Promise<ResultRecord | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    if (!/^\d+$/.test(testCase.id)) return result;
    const saved = await prisma.evalResult.create({
      data: {
        runCode: result.runCode,
        caseId: BigInt(testCase.id),
        appCode: testCase.appCode,
        caseSnapshotJson: result.caseSnapshotJson ?? this.caseSnapshot(testCase),
        appStatus: result.appStatus ?? 'PENDING',
        evaluationStatus: result.evaluationStatus ?? 'PENDING',
        requestJson: result.requestJson ?? {},
        responseJson: result.responseJson ?? null,
        finalAnswer: result.finalAnswer,
        ruleScore: result.finalScore,
        judgeScore: result.finalScore,
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
    if (!prisma) return null;
    if (!/^\d+$/u.test(result.resultId)) return result;
    const saved = await prisma.evalResult.update({
      where: { id: BigInt(result.resultId) },
      data: {
        caseSnapshotJson: result.caseSnapshotJson ?? undefined,
        appStatus: result.appStatus ?? 'PENDING',
        evaluationStatus: result.evaluationStatus ?? 'PENDING',
        requestJson: result.requestJson ?? {},
        responseJson: result.responseJson ?? null,
        finalAnswer: result.finalAnswer,
        ruleScore: result.finalScore,
        judgeScore: result.finalScore,
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
    if (!prisma) return null;
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
    if (!prisma) return null;
    const saved = await prisma.evalJudgeCall.create({ data: this.toJudgeCallPayload(call) });
    return this.toJudgeCall(saved);
  }

  async updateJudgeCall(call: JudgeCallRecord): Promise<JudgeCallRecord | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const saved = await prisma.evalJudgeCall.update({
      where: { callCode: call.callCode },
      data: this.toJudgeCallPayload(call),
    });
    return this.toJudgeCall(saved);
  }

  async listJudgeCalls(runCode: string): Promise<JudgeCallRecord[] | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const rows = await prisma.evalJudgeCall.findMany({ where: { runCode }, orderBy: { id: 'asc' } });
    return rows.map((row) => this.toJudgeCall(row));
  }

  async findJudgeCallByResult(resultId: string): Promise<JudgeCallRecord | null | undefined> {
    const prisma = await this.prismaPromise;
    if (!prisma) return undefined;
    if (!/^\d+$/u.test(resultId)) return null;
    const row = await prisma.evalJudgeCall.findFirst({ where: { resultId: BigInt(resultId) }, orderBy: { id: 'desc' } });
    return row ? this.toJudgeCall(row) : null;
  }

  private toJudgeCallPayload(call: JudgeCallRecord) {
    return {
      callCode: call.callCode,
      runCode: call.runCode,
      resultId: /^\d+$/u.test(call.resultId) ? BigInt(call.resultId) : BigInt(0),
      appCode: call.appCode,
      caseId: /^\d+$/u.test(call.caseId) ? BigInt(call.caseId) : BigInt(0),
      providerCode: call.providerCode,
      modelDbId: /^\d+$/u.test(call.modelDbId) ? BigInt(call.modelDbId) : BigInt(0),
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
    if (process.env.VITEST) return null;
    return createRuntimePrismaClient<ExecutionPrismaClient>();
  }

  private toCase(row: unknown): ExecutionCaseRecord {
    const data = this.asRecord(row);
    const inputJson = this.asRecord(data.inputJson);
    const expectedJson = this.asRecord(data.expectedJson);
    return {
      id: String(data.id),
      caseName: String(data.caseName ?? ''),
      appCode: String(data.appCode ?? ''),
      caseScope: data.caseScope === 'SYSTEM_PRESET' ? 'SYSTEM_PRESET' : 'APP',
      categoryId: String(data.categoryId ?? ''),
      riskLevel: String(data.riskLevel ?? 'MEDIUM'),
      inputJson,
      expectedJson,
      query: typeof inputJson.query === 'string' ? inputJson.query : '',
      expectedBehavior: typeof expectedJson.expectedBehavior === 'string' ? expectedJson.expectedBehavior : '',
      enabled: data.enabled !== false,
    };
  }

  private toPlan(row: unknown): ExecutionPlanRecord {
    const data = this.asRecord(row);
    return {
      planCode: String(data.planCode),
      planName: String(data.planName),
      appCode: String(data.appCode),
      caseFilter: this.asRecord(data.caseFilterJson),
      status: data.status === 'DISABLED' ? 'DISABLED' : 'ENABLED',
    };
  }

  private toApp(row: unknown): ExecutionAppRecord {
    const data = this.asRecord(row);
    const adapterConfig = this.asRecord(data.adapterConfig);
    const response = this.asRecord(adapterConfig.response);
    const templates = this.asRecord(adapterConfig.templates);
    const execution = this.asRecord(adapterConfig.execution);
    return {
      appCode: String(data.appCode),
      appName: String(data.appName),
      requestMethod: this.normalizeMethod(data.requestMethod),
      invokeUrl: String(data.invokeUrl ?? ''),
      authType: this.normalizeAuthType(data.authType),
      authConfig: this.asOptionalRecord(data.authConfig),
      headerTemplate: String(templates.headerTemplate ?? DEFAULT_HEADER_TEMPLATE),
      bodyTemplate: String(templates.bodyTemplate ?? DEFAULT_BODY_TEMPLATE),
      streamEnabled: templates.streamEnabled === true,
      adapterConfig: {
        response: {
          answerPath: String(response.answerPath ?? DEFAULT_ANSWER_PATH),
          successExpression: String(response.successExpression ?? DEFAULT_SUCCESS_EXPRESSION),
        },
        execution: {
          appConcurrency: this.normalizeConcurrency(execution.appConcurrency),
        },
      },
    };
  }

  private toEvaluationConfig(row: unknown): EvaluationConfigRecord {
    const data = this.asRecord(row);
    const customPrompt = typeof data.customPrompt === 'string' ? data.customPrompt : '';
    const promptOverrideEnabled = data.promptOverrideEnabled === true;
    return {
      appCode: String(data.appCode),
      modelId: String(data.modelId ?? ''),
      promptOverrideEnabled,
      systemPrompt: DEFAULT_EVALUATION_PROMPT,
      customPrompt,
      effectivePrompt: promptOverrideEnabled && customPrompt ? customPrompt : DEFAULT_EVALUATION_PROMPT,
      evaluationConcurrency: this.normalizeConcurrency(data.evaluationConcurrency),
    };
  }

  private toJudgeModel(row: unknown): JudgeModelRecord {
    const data = this.asRecord(row);
    return {
      id: String(data.id),
      modelName: String(data.modelName ?? ''),
      providerCode: String(data.providerCode ?? ''),
      modelId: String(data.modelId ?? ''),
      modelType: data.modelType === 'EMBEDDING' ? 'EMBEDDING' : 'LLM',
      protocol: String(data.protocol ?? 'OPENAI_CHAT_COMPLETIONS'),
      parameters: this.asRecord(data.parametersJson),
      limits: {
        pricing: this.normalizePricing(this.asRecord(data.limitsJson).pricing),
      },
      enabled: data.enabled !== false,
    };
  }

  private toJudgeProvider(row: unknown): JudgeProviderRecord {
    const data = this.asRecord(row);
    return {
      providerCode: String(data.providerCode ?? ''),
      providerName: String(data.providerName ?? ''),
      providerType: String(data.providerType ?? ''),
      baseUrl: String(data.baseUrl ?? ''),
      apiKey: String(data.apiKey ?? ''),
      enabled: data.enabled !== false,
    };
  }

  private toRun(row: unknown): RunRecord {
    const data = this.asRecord(row);
    const startAt = this.toIsoString(data.startedAt);
    const endAt = this.toIsoString(data.finishedAt);
    const durationMs = startAt && endAt ? new Date(endAt).getTime() - new Date(startAt).getTime() : undefined;
    return {
      runCode: String(data.runCode),
      planCode: String(data.planCode),
      appCode: String(data.appCode),
      status: this.normalizeRunStatus(data.status),
      phase: this.normalizeRunPhase(data.phase, this.normalizeRunStatus(data.status)),
      sequenceNo: this.optionalNumber(data.sequenceNo),
      totalCount: Number(data.totalCount ?? 0),
      appCompletedCount: Number(data.appCompletedCount ?? 0),
      evalCompletedCount: Number(data.evalCompletedCount ?? 0),
      passCount: Number(data.passCount ?? 0),
      failCount: Number(data.failCount ?? 0),
      reviewCount: Number(data.reviewCount ?? 0),
      avgScore: Number(data.avgScore?.toString?.() ?? data.avgScore ?? 0),
      normalInputTokens: Number(data.normalInputTokens ?? 0),
      cachedInputTokens: Number(data.cachedInputTokens ?? 0),
      outputTokens: Number(data.outputTokens ?? 0),
      totalTokens: Number(data.totalTokens ?? 0),
      normalInputCostAmount: this.optionalDecimalNumber(data.normalInputCostAmount),
      cachedInputCostAmount: this.optionalDecimalNumber(data.cachedInputCostAmount),
      outputCostAmount: this.optionalDecimalNumber(data.outputCostAmount),
      totalCostAmount: this.optionalDecimalNumber(data.totalCostAmount),
      currency: typeof data.currency === 'string' ? data.currency : undefined,
      costStatus: this.normalizeCostStatus(data.costStatus),
      startAt,
      endAt,
      durationMs,
    };
  }

  private normalizeRunStatus(value: unknown): RunRecord['status'] {
    if (value === 'RUNNING' || value === 'CANCELLED' || value === 'FAILED') return value;
    return 'COMPLETED';
  }

  private normalizeRunPhase(value: unknown, status: RunRecord['status']): RunPhase {
    if (
      value === 'PENDING' ||
      value === 'APP_CALLING' ||
      value === 'EVALUATING' ||
      value === 'COSTING' ||
      value === 'COMPLETED' ||
      value === 'FAILED' ||
      value === 'CANCELLED'
    ) return value;
    if (status === 'RUNNING') return 'APP_CALLING';
    return status === 'CANCELLED' ? 'CANCELLED' : status === 'FAILED' ? 'FAILED' : 'COMPLETED';
  }

  private normalizeResultPhaseStatus(value: unknown): ResultPhaseStatus {
    if (value === 'RUNNING' || value === 'PASSED' || value === 'FAILED' || value === 'SKIPPED') return value;
    return 'PENDING';
  }

  private normalizeManualResult(value: unknown): ResultRecord['manualResult'] {
    if (value === null) return null;
    if (value === 'PASS' || value === 'FAIL') return value;
    return undefined;
  }

  private normalizeCostStatus(value: unknown): RunRecord['costStatus'] {
    if (value === 'CALCULATED' || value === 'NO_USAGE' || value === 'SKIPPED_NO_PRICE' || value === 'PARTIAL') return value;
    return 'NOT_CALCULATED';
  }

  private normalizeJudgeCostStatus(value: unknown): JudgeCost['costStatus'] {
    if (value === 'CALCULATED' || value === 'NO_USAGE') return value;
    return 'SKIPPED_NO_PRICE';
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

  private toJudgeCall(row: unknown): JudgeCallRecord {
    const data = this.asRecord(row);
    return {
      callCode: String(data.callCode),
      runCode: String(data.runCode),
      resultId: String(data.resultId),
      appCode: String(data.appCode),
      caseId: String(data.caseId),
      providerCode: String(data.providerCode),
      modelDbId: String(data.modelDbId),
      modelId: String(data.modelId),
      protocol: String(data.protocol),
      promptText: String(data.promptText ?? ''),
      requestJson: this.asRecord(data.requestJson),
      responseJson: this.asOptionalRecord(data.responseJson),
      rawResponseText: typeof data.rawResponseText === 'string' ? data.rawResponseText : undefined,
      rawUsageJson: this.asOptionalRecord(data.rawUsageJson),
      normalInputTokens: this.optionalNumber(data.normalInputTokens),
      cachedInputTokens: this.optionalNumber(data.cachedInputTokens),
      outputTokens: this.optionalNumber(data.outputTokens),
      totalTokens: this.optionalNumber(data.totalTokens),
      normalInputCostAmount: this.optionalDecimalNumber(data.normalInputCostAmount),
      cachedInputCostAmount: this.optionalDecimalNumber(data.cachedInputCostAmount),
      outputCostAmount: this.optionalDecimalNumber(data.outputCostAmount),
      totalCostAmount: this.optionalDecimalNumber(data.totalCostAmount),
      currency: typeof data.currency === 'string' ? data.currency : undefined,
      costStatus: this.normalizeJudgeCostStatus(data.costStatus),
      status: data.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED',
      errorCode: typeof data.errorCode === 'string' ? data.errorCode : undefined,
      errorMessage: typeof data.errorMessage === 'string' ? data.errorMessage : undefined,
      elapsedMs: this.optionalNumber(data.elapsedMs),
    };
  }

  private caseSnapshot(testCase: ExecutionCaseRecord): Record<string, unknown> {
    return {
      caseId: testCase.id,
      caseName: testCase.caseName,
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
    const data = this.asRecord(row);
    const caseSnapshotJson = this.asRecord(data.caseSnapshotJson);
    const requestJson = this.asRecord(data.requestJson);
    const responseJson = this.asRecord(data.responseJson);
    const snapshotFields = readCaseSnapshotFields(caseSnapshotJson, requestJson);
    return {
      resultId: String(data.id ?? data.resultId),
      runCode: String(data.runCode),
      caseCode: String(data.caseId ?? data.caseCode),
      caseName: snapshotFields.caseName,
      categoryId: snapshotFields.categoryId,
      query: snapshotFields.query,
      expectedBehavior: snapshotFields.expectedBehavior,
      caseSnapshotJson,
      appStatus: this.normalizeResultPhaseStatus(data.appStatus),
      evaluationStatus: this.normalizeResultPhaseStatus(data.evaluationStatus),
      requestJson,
      responseJson,
      finalAnswer: String(data.finalAnswer ?? ''),
      finalScore: Number(data.finalScore?.toString?.() ?? data.finalScore ?? 0),
      passStatus: data.passStatus === 'FAIL' || data.passStatus === 'REVIEW' ? data.passStatus : 'PASS',
      failureReason: typeof data.failureReason === 'string' ? data.failureReason : undefined,
      problemType: typeof data.problemType === 'string' ? data.problemType : undefined,
      elapsedMs: data.elapsedMs === null || data.elapsedMs === undefined ? undefined : Number(data.elapsedMs),
      appElapsedMs: data.appElapsedMs === null || data.appElapsedMs === undefined ? undefined : Number(data.appElapsedMs),
      judgeElapsedMs: data.judgeElapsedMs === null || data.judgeElapsedMs === undefined ? undefined : Number(data.judgeElapsedMs),
      errorCode: typeof data.errorCode === 'string' ? data.errorCode : undefined,
    };
  }

  private toResultReview(row: unknown): Pick<ResultRecord, 'resultId' | 'manualResult' | 'reviewStatus' | 'reviewComment'> {
    const data = this.asRecord(row);
    return {
      resultId: String(data.resultId),
      manualResult: this.normalizeManualResult(data.manualResult),
      reviewStatus: data.reviewStatus === 'REVIEWED' ? 'REVIEWED' : 'PENDING',
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

  private normalizeMethod(value: unknown): ExecutionAppRecord['requestMethod'] {
    return value === 'GET' || value === 'PUT' || value === 'PATCH' ? value : 'POST';
  }

  private normalizeAuthType(value: unknown): ExecutionAppRecord['authType'] {
    return value === 'API_KEY' || value === 'BEARER_TOKEN' || value === 'BASIC' ? value : 'NONE';
  }
}

export class ExecutionService {
  private readonly database: ExecutionDataStore;
  private readonly fetchImpl: typeof fetch;
  private readonly runs = new Map<string, RunRecord>();
  private readonly results = new Map<string, ResultRecord[]>();
  private readonly cases = new Map<string, ExecutionCaseRecord>();
  private readonly plans = new Map<string, ExecutionPlanRecord>();
  private readonly apps = new Map<string, ExecutionAppRecord>();
  private readonly evaluationConfigs = new Map<string, EvaluationConfigRecord>();
  private readonly judgeModels = new Map<string, JudgeModelRecord>();
  private readonly judgeProviders = new Map<string, JudgeProviderRecord>();
  private readonly backgroundRunner: BackgroundRunner;
  private readonly workerEnabled: boolean;
  private readonly activeRunCodes = new Set<string>();
  private readonly runCaseSnapshots = new Map<string, ExecutionCaseRecord[]>();
  private readonly judgeCalls = new Map<string, JudgeCallRecord[]>();
  private readonly runOrders = new Map<string, number>();
  private nextRunOrder = 0;

  constructor(deps: ExecutionServiceDeps = {}) {
    this.database = deps.database ?? new ExecutionDatabase();
    this.fetchImpl = deps.fetchImpl ?? fetch;
    this.backgroundRunner = deps.backgroundRunner ?? ((task) => {
      void task().catch(() => undefined);
    });
    this.workerEnabled = deps.workerEnabled ?? true;
    const recoverOnStart = deps.recoverOnStart ?? (!process.env.VITEST && this.workerEnabled);
    if (recoverOnStart) this.backgroundRunner(() => this.recoverRunningRuns());
  }

  /**
   * @author codex
   * Starts an execution run from the saved plan, current application protocol, and database cases.
   */
  async start(request: { planCode: string; appCode: string; caseCodes?: string[] }): Promise<RunRecord> {
    const plan = await this.getPlan(request.planCode, request.appCode);
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
    const savedRun = await this.database.createRun(run);
    const nextRun = savedRun ?? run;
    this.runs.set(nextRun.runCode, nextRun);
    this.rememberRunOrder(nextRun.runCode);
    const placeholders = await Promise.all(cases.map(async (testCase, index) => {
      const pendingResult = this.pendingResult(nextRun.runCode, testCase, index);
      const savedResult = await this.database.createResult(pendingResult, testCase);
      return this.enrichResult(savedResult ?? pendingResult);
    }));
    this.results.set(nextRun.runCode, placeholders);
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
    const plan = await this.getPlan(run.planCode, run.appCode);
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
    const memoryCall = Array.from(this.judgeCalls.values()).flat().find((call) => call.resultId === resultId);
    const call = memoryCall ?? await this.database.findJudgeCallByResult?.(resultId);
    if (!call) throw new Error('评估调用审计不存在');
    return call;
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
      return saved ?? nextCall;
    }));
    this.judgeCalls.set(runCode, recalculatedCalls);
    const results = await this.getResultSource(runCode);
    const savedRun = await this.persistRun(this.summarizeRun(run, results, run.status, run.phase, await this.calculateRunCostSummary(runCode)));
    const plan = await this.getPlan(savedRun.planCode, savedRun.appCode);
    const sequencedRun = await this.attachRunSequence(savedRun);
    return { ...sequencedRun, planName: plan.planName };
  }

  async rerun(runCode: string): Promise<RunRecord> {
    const run = await this.getRun(runCode);
    return this.persistRun({ ...run, status: 'COMPLETED' });
  }

  /**
   * 仅重新发起 AI 评估，不重新调用业务接口。
   * 适用于：未达标用例希望重跑评估、执行失败用例已有业务返回值时重跑评估。
   * @author Antigravity/Claude-Sonnet-4.6
   */
  async reEvaluate(resultIds: string[]): Promise<ResultRecord[]> {
    if (resultIds.length === 0) throw new BadRequestException('resultIds 不能为空');

    // 找到这些 result 所在的 run
    const allResults = Array.from(this.results.values()).flat();
    const targetResults = allResults.filter((r) => resultIds.includes(r.resultId));

    // 内存中找不到的，尝试通过已知 run 从持久层加载
    const foundIds = new Set(targetResults.map((r) => r.resultId));
    const missingIds = resultIds.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      const allRuns = await this.getRunSource();
      for (const run of allRuns) {
        if (missingIds.length === 0) break;
        const runResults = await this.getResultSource(run.runCode);
        for (const r of runResults) {
          const idx = missingIds.indexOf(r.resultId);
          if (idx >= 0) {
            targetResults.push(r);
            missingIds.splice(idx, 1);
          }
        }
      }
    }
    if (targetResults.length === 0) throw new BadRequestException('找不到对应的执行结果');

    const runCode = targetResults[0].runCode;
    const run = await this.getRun(runCode);
    const judgeContext = await this.getJudgeContext(run.appCode);

    const updatedResults: ResultRecord[] = [];
    for (const result of targetResults) {
      // 从 caseSnapshot 重建 testCase，用于评估调用
      const snapshot = result.caseSnapshotJson ?? {};
      const snapshotFields = readCaseSnapshotFields(snapshot, result.requestJson);
      const testCase: ExecutionCaseRecord = {
        id: result.caseCode,
        caseName: snapshotFields.caseName ?? result.caseName ?? '',
        appCode: run.appCode,
        categoryId: String(snapshot.categoryId ?? ''),
        riskLevel: '',
        inputJson: asPlainRecord(snapshot.inputJson),
        expectedJson: asPlainRecord(snapshot.expectedJson),
        query: snapshotFields.query ?? result.query ?? '',
        expectedBehavior: snapshotFields.expectedBehavior ?? result.expectedBehavior ?? '',
        enabled: true,
      };
      const evaluated = await this.evaluateResultWithJudge(run, testCase, result, judgeContext);
      const saved = await this.persistResultUpdate(evaluated, testCase);
      updatedResults.push(saved);
      // 同步内存缓存
      const runResults = await this.getResultSource(runCode);
      this.replaceResult(runResults, saved);
    }

    // 重新汇总 run 统计
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
    const runningRuns = (await this.getRunSource()).filter((run) => run.status === 'RUNNING');
    for (const run of runningRuns) {
      if (this.activeRunCodes.has(run.runCode)) continue;
      this.activeRunCodes.add(run.runCode);
      await this.processRunJob(run.runCode);
    }
  }

  private scheduleRun(runCode: string) {
    if (!this.workerEnabled || this.activeRunCodes.has(runCode)) return;
    this.activeRunCodes.add(runCode);
    this.backgroundRunner(() => this.processRunJob(runCode));
  }

  private async processRunJob(runCode: string) {
    let run: RunRecord | undefined;
    try {
      run = await this.getRun(runCode);
      if (run.status !== 'RUNNING') return;

      const plan = await this.getPlan(run.planCode, run.appCode);
      const cases = this.runCaseSnapshots.get(run.runCode) ?? (await this.resolveCases({ appCode: run.appCode }, plan));
      const results = await this.ensureRunResults(run, cases);

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
          await this.persistRun(this.summarizeRun(run!, results, 'RUNNING', 'APP_CALLING'));
        });
        run = await this.persistRun(this.summarizeRun(run, results, 'RUNNING', 'EVALUATING'));
      }

      if (run.phase !== 'COSTING') {
        await this.evaluateCompletedAppResults(run, cases, results);
        run = await this.persistRun(this.summarizeRun(run, results, 'RUNNING', 'COSTING'));
      }

      const costSummary = await this.calculateRunCostSummary(run.runCode);
      await this.persistRun(this.summarizeRun(run, results, 'COMPLETED', 'COMPLETED', costSummary));
    } catch {
      if (!run) return;
      let currentResults: ResultRecord[] = [];
      try {
        currentResults = await this.getResultSource(run.runCode);
      } catch {
        currentResults = this.results.get(run.runCode) ?? [];
      }
      await this.persistRun(this.summarizeRun(run, currentResults, 'FAILED'));
    } finally {
      this.activeRunCodes.delete(runCode);
      this.runCaseSnapshots.delete(runCode);
    }
  }

  private async ensureRunResults(run: RunRecord, cases: ExecutionCaseRecord[]) {
    const results = await this.getResultSource(run.runCode);
    const shouldCreateMissing = this.runCaseSnapshots.has(run.runCode);
    for (const [index, testCase] of cases.entries()) {
      if (this.findResult(results, testCase.id)) continue;
      const pendingResult = this.pendingResult(run.runCode, testCase, index);
      const savedResult = shouldCreateMissing ? await this.database.createResult(pendingResult, testCase) : null;
      results.push(this.enrichResult(savedResult ?? pendingResult));
    }
    this.results.set(run.runCode, [...results]);
    return results;
  }

  private pendingResult(runCode: string, testCase: ExecutionCaseRecord, index: number): ResultRecord {
    return {
      resultId: `${runCode}_RESULT_${index + 1}`,
      runCode,
      caseCode: testCase.id,
      caseName: testCase.caseName,
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
    this.results.set(nextResult.runCode, [...results]);
  }

  private async persistResultUpdate(result: ResultRecord, testCase: ExecutionCaseRecord) {
    const saved = await this.database.updateResult?.(result, testCase);
    return this.enrichResult(saved ?? result);
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
    try {
      const resolvedHeaders = this.renderTemplate(app.headerTemplate, this.caseTemplateData(testCase));
      const resolvedBody = this.renderTemplate(app.bodyTemplate, this.caseTemplateData(testCase));
      const requestHeaders = this.applyAuthHeaders(this.parseJsonObject(resolvedHeaders), app);
      const requestJson = app.requestMethod === 'GET' ? {} : this.parseJsonObject(resolvedBody);
      const upstream = await this.fetchWithTimeout(app.invokeUrl, {
        method: app.requestMethod,
        headers: requestHeaders,
        body: app.requestMethod === 'GET' ? undefined : resolvedBody,
      });
      const rawText = await upstream.text();
      const responseJson = this.parseResponse(rawText, app.streamEnabled);
      const finalAnswer = String(this.readJsonPath(responseJson, app.adapterConfig.response.answerPath) ?? '');
      const assertionPassed = this.evaluateSuccessExpression(responseJson, app.adapterConfig.response.successExpression);
      const protocolPassed = upstream.ok && (assertionPassed === true || (assertionPassed === undefined && finalAnswer.trim().length > 0));
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
    if (this.isTerminalResultStatus(result.appStatus)) return true;
    return result.appStatus === undefined && result.evaluationStatus === undefined && (Boolean(result.finalAnswer) || result.passStatus !== 'REVIEW');
  }

  private isCountableResult(result: ResultRecord) {
    if (this.isTerminalResultStatus(result.evaluationStatus)) return true;
    if (result.appStatus === undefined && result.evaluationStatus === undefined) return true;
    return false;
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
    const nextCall = saved ?? call;
    const calls = this.judgeCalls.get(nextCall.runCode) ?? [];
    const existingIndex = calls.findIndex((item) => item.callCode === nextCall.callCode || item.resultId === nextCall.resultId);
    if (existingIndex >= 0) calls[existingIndex] = nextCall;
    else calls.push(nextCall);
    this.judgeCalls.set(nextCall.runCode, calls);
    return nextCall;
  }

  private async getJudgeCallSource(runCode: string) {
    const memoryCalls = this.judgeCalls.get(runCode);
    if (memoryCalls && memoryCalls.length > 0) return memoryCalls;
    const databaseCalls = await this.database.listJudgeCalls?.(runCode);
    if (databaseCalls) this.judgeCalls.set(runCode, databaseCalls);
    return databaseCalls ?? [];
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
      caseName: testCase.caseName,
      categoryId: testCase.categoryId,
      question: testCase.query,
      expectedAnswer: testCase.expectedBehavior,
      inputJson: testCase.inputJson,
      expectedJson: testCase.expectedJson,
    };
  }

  private async resolveCases(request: { appCode: string; caseCodes?: string[] }, plan: ExecutionPlanRecord) {
    const caseFilter = plan.caseFilter ?? {};
    const categoryCodes = this.stringArray(caseFilter.categoryCodes);
    const riskLevels = this.stringArray(caseFilter.riskLevels);
    const selectedCaseCodes = this.stringArray(caseFilter.selectedCaseCodes);
    const requestCaseCodes = this.stringArray(request.caseCodes);
    const requestedSet = new Set([...selectedCaseCodes, ...requestCaseCodes]);

    const subscriptions = await this.database.listSubscriptions?.(request.appCode) ?? [];
    const subscribedCategoryIds = new Set(subscriptions.map(s => s.categoryId));

    return (await this.getCaseSource()).filter((testCase) => {
      const isSubscribedPreset = testCase.caseScope === 'SYSTEM_PRESET' && subscribedCategoryIds.has(testCase.categoryId);
      const appMatched = testCase.appCode === request.appCode || isSubscribedPreset;
      const enabledMatched = testCase.enabled;
      const categoryMatched = categoryCodes.length === 0 || categoryCodes.includes(testCase.categoryId);
      const riskMatched = riskLevels.length === 0 || riskLevels.includes(testCase.riskLevel);
      const selectedMatched = requestedSet.size === 0 || requestedSet.has(testCase.id);
      return appMatched && enabledMatched && categoryMatched && riskMatched && selectedMatched;
    });
  }

  private failedResult(runCode: string, testCase: ExecutionCaseRecord, index: number, errorCode: string, failureReason: string, elapsedMs = 0): ResultRecord {
    return {
      resultId: `${runCode}_RESULT_${index + 1}`,
      runCode,
      caseCode: testCase.id,
      caseName: testCase.caseName,
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
    const requestJson = this.buildJudgeRequestBody(judgeContext, testCase, finalAnswer);
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
      const response = await this.fetchWithTimeout(this.buildJudgeEndpoint(judgeContext.provider.baseUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${judgeContext.provider.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestJson),
      }, judgeTimeoutMs);
      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = this.parseJsonObject(text, { rawText: text });
      const content = this.extractJudgeMessageContent(payload);
      const usage = normalizeJudgeUsage(payload.usage);
      const cost = calculateJudgeCost(usage, judgeContext.model.limits?.pricing);
      return {
        score: this.parseJudgeResult(content),
        call: {
          ...baseCall(),
          responseJson: payload,
          rawResponseText: text,
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
          elapsedMs: Date.now() - startedAt,
        },
      };
    } catch (error) {
      const failureReason = this.describeJudgeFailure(error, judgeTimeoutMs);
      return {
        score: {
          finalScore: 0,
          passStatus: 'FAIL',
          failureReason,
          problemType: '评估调用失败',
          errorCode: 'JUDGE_EVALUATION_FAILED',
        },
        call: {
          ...baseCall(),
          costStatus: 'NO_USAGE',
          status: 'FAILED',
          errorCode: 'JUDGE_EVALUATION_FAILED',
          errorMessage: failureReason,
          elapsedMs: Date.now() - startedAt,
        },
      };
    }
  }

  private buildJudgeRequestBody(judgeContext: JudgeContext, testCase: ExecutionCaseRecord, finalAnswer: string) {
    const parameters = judgeContext.model.parameters;
    const body: Record<string, unknown> = {
      model: judgeContext.model.modelId,
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
      max_tokens: this.resolveJudgeMaxOutputTokens(parameters),
    };
    if (parameters.jsonMode === true) body.response_format = { type: 'json_object' };
    if (typeof parameters.topP === 'number') body.top_p = parameters.topP;
    if (judgeContext.provider.providerType === 'QWEN' || judgeContext.model.protocol === 'DASHSCOPE_COMPATIBLE_CHAT') {
      body.enable_thinking = false;
    }
    if (parameters.reasoningEffort) body.reasoning_effort = parameters.reasoningEffort;
    return body;
  }

  private buildJudgeEndpoint(baseUrl: string) {
    return `${baseUrl.replace(/\/+$/u, '')}/chat/completions`;
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
    const parsed = this.parseJsonObject(jsonText);
    const passStatus = this.normalizeJudgeStatus(parsed.passStatus);
    const score = Number(parsed.score ?? parsed.finalScore ?? 0);
    const reason = typeof parsed.reason === 'string'
      ? parsed.reason
      : typeof parsed.failureReason === 'string'
        ? parsed.failureReason
        : '评估模型未返回评分理由';
    return {
      finalScore: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0,
      passStatus,
      failureReason: reason,
      problemType: typeof parsed.problemType === 'string' ? parsed.problemType : undefined,
    };
  }

  private normalizeJudgeStatus(value: unknown): EvaluationScore['passStatus'] {
    return value === 'PASS' || value === 'REVIEW' ? value : 'FAIL';
  }

  private async getCaseSource() {
    const databaseCases = await this.database.listCases();
    if (databaseCases) {
      const normalizedCases = databaseCases.map((testCase) => this.normalizeCaseRecord(testCase));
      this.cases.clear();
      normalizedCases.forEach((testCase) => this.cases.set(testCase.id, testCase));
      return normalizedCases;
    }
    return Array.from(this.cases.values());
  }

  private async getRunSource() {
    const databaseRuns = await this.database.listRuns();
    if (databaseRuns) {
      this.runs.clear();
      [...databaseRuns].reverse().forEach((run) => this.rememberRunOrder(run.runCode));
      databaseRuns.forEach((run) => this.runs.set(run.runCode, run));
      return databaseRuns;
    }
    const memoryRuns = Array.from(this.runs.values());
    memoryRuns.forEach((run) => this.rememberRunOrder(run.runCode));
    return memoryRuns;
  }

  private async getResultSource(runCode: string) {
    const databaseResults = await this.database.listResults(runCode);
    const sourceResults = databaseResults ?? this.results.get(runCode) ?? [];
    if (databaseResults) this.results.set(runCode, databaseResults);
    return sourceResults.map((result) => this.enrichResult(result));
  }

  private async getPlan(planCode: string, appCode: string) {
    const databasePlan = await this.database.findPlan?.(planCode);
    const plan = databasePlan !== undefined ? databasePlan : this.plans.get(planCode);
    if (plan) {
      this.plans.set(plan.planCode, plan);
      return plan;
    }
    return {
      planCode,
      planName: planCode,
      appCode,
      caseFilter: {},
      status: 'ENABLED' as const,
    };
  }

  private async getApp(appCode: string) {
    const databaseApp = await this.database.findApp?.(appCode);
    const app = databaseApp !== undefined ? databaseApp : this.apps.get(appCode);
    if (!app) throw new Error('应用协议不存在');
    this.apps.set(app.appCode, app);
    return app;
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
    const databaseConfig = await this.database.findEvaluationConfig?.(appCode);
    const config = databaseConfig !== undefined ? databaseConfig : this.evaluationConfigs.get(appCode);
    if (config) this.evaluationConfigs.set(appCode, config);
    return config ?? null;
  }

  private async getJudgeModel(modelId: string) {
    const databaseModel = await this.database.findJudgeModel?.(modelId);
    const model = databaseModel !== undefined ? databaseModel : this.judgeModels.get(modelId);
    if (model) this.judgeModels.set(model.id, model);
    return model ?? null;
  }

  private async getJudgeProvider(providerCode: string) {
    const databaseProvider = await this.database.findJudgeProvider?.(providerCode);
    const provider = databaseProvider !== undefined ? databaseProvider : this.judgeProviders.get(providerCode);
    if (provider) this.judgeProviders.set(provider.providerCode, provider);
    return provider ?? null;
  }

  private async getRun(runCode: string) {
    const databaseRun = await this.database.findRun(runCode);
    const run = databaseRun ?? this.runs.get(runCode);
    if (!run) throw new Error('执行批次不存在');
    this.runs.set(run.runCode, run);
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
    if (Number.isFinite(time)) return time;
    const legacyTime = Number(run.runCode.split('_RUN_')[1] ?? 0);
    return Number.isFinite(legacyTime) ? legacyTime : 0;
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
      if (!existingRun && !this.runs.has(runCode)) return runCode;
    }
    throw new Error('执行批次编码生成失败，请重试');
  }

  private async persistRun(run: RunRecord) {
    const saved = await this.database.updateRun(run);
    const next = saved ?? run;
    this.runs.set(next.runCode, next);
    this.rememberRunOrder(next.runCode);
    return next;
  }

  private enrichResult(result: ResultRecord): ResultRecord {
    const snapshotFields = readCaseSnapshotFields(result.caseSnapshotJson, result.requestJson);
    return {
      ...result,
      caseName: result.caseName ?? snapshotFields.caseName,
      categoryId: result.categoryId ?? snapshotFields.categoryId,
      query: result.query ?? snapshotFields.query,
      expectedBehavior: result.expectedBehavior ?? snapshotFields.expectedBehavior,
    };
  }

  private normalizeCaseRecord(testCase: ExecutionCaseRecord): ExecutionCaseRecord {
    const inputJson = testCase.inputJson ?? {};
    const expectedJson = testCase.expectedJson ?? {};
    const query = testCase.query || (typeof inputJson.query === 'string' ? inputJson.query : '');
    const expectedBehavior = testCase.expectedBehavior || (typeof expectedJson.expectedBehavior === 'string' ? expectedJson.expectedBehavior : '');
    return {
      ...testCase,
      inputJson,
      expectedJson,
      query,
      expectedBehavior,
      enabled: testCase.enabled !== false,
    };
  }

  private caseTemplateData(testCase: ExecutionCaseRecord) {
    return {
      case: {
        id: testCase.id,
        name: testCase.caseName,
        query: testCase.query,
        expectedBehavior: testCase.expectedBehavior,
        input: testCase.inputJson,
      },
      query: testCase.query,
      expectedBehavior: testCase.expectedBehavior,
    };
  }

  private renderTemplate(template: string, data: Record<string, unknown>) {
    return template.replace(/\{\{([^}]+)}}/g, (_, rawPath: string) => {
      const path = rawPath.trim();
      return String(this.readObjectPath(data, path) ?? '');
    });
  }

  private applyAuthHeaders(headers: Record<string, unknown>, app: ExecutionAppRecord): Record<string, string> {
    const normalizedHeaders = Object.entries(headers).reduce<Record<string, string>>(
      (current, [key, value]) => ({ ...current, [key]: String(value) }),
      {},
    );
    const authConfig = app.authConfig ?? {};
    if (app.authType === 'BEARER_TOKEN' && typeof authConfig.token === 'string') {
      return { ...normalizedHeaders, Authorization: `Bearer ${authConfig.token}` };
    }
    if (app.authType === 'API_KEY' && typeof authConfig.headerName === 'string' && typeof authConfig.apiKey === 'string') {
      return { ...normalizedHeaders, [authConfig.headerName]: authConfig.apiKey };
    }
    if (app.authType === 'BASIC' && typeof authConfig.username === 'string' && typeof authConfig.password === 'string') {
      const encoded = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64');
      return { ...normalizedHeaders, Authorization: `Basic ${encoded}` };
    }
    return normalizedHeaders;
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
    if (!streamEnabled) return this.parseJsonObject(text, { rawText: text });
    return this.parseJsonObject(text, { rawText: text });
  }

  private parseServerSentEvents(text: string): Record<string, unknown> | null {
    const chunks = text
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .map((line) => line.match(/^data:\s*(.*)$/u)?.[1]?.trim() ?? '')
      .filter((line) => line && line !== '[DONE]');
    if (chunks.length === 0) return null;

    const parsedChunks = chunks.map((chunk) => this.parseJsonObject(chunk, { content: chunk }));
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

  private parseJsonObject(text: string, fallback: Record<string, unknown> = {}) {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback;
      return parsed as Record<string, unknown>;
    } catch {
      return fallback;
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

  private evaluateSuccessExpression(data: Record<string, unknown>, expression: string): boolean | undefined {
    const normalized = expression.trim();
    if (!normalized) return true;
    const [path, expectedRaw] = normalized.split('==').map((item) => item.trim());
    if (!path || expectedRaw === undefined) return true;
    const expected = expectedRaw.replace(/^['"]|['"]$/g, '');
    const actual = this.readJsonPath(data, path);
    if (actual === undefined || actual === null) return undefined;
    return String(actual) === expected;
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }
}
