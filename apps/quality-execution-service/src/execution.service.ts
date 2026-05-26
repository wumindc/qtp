/**
 * 执行服务：按计划筛选用例、调用应用协议并持久化真实执行结果
 * @author codex
 */
import { randomBytes } from 'node:crypto';
import { createRuntimePrismaClient } from '@ai-quality-platform/shared-database';
import { pageResult, type PageResult } from '@ai-quality-platform/shared-http';
import { BadRequestException } from '@nestjs/common';

export interface RunRecord {
  runCode: string;
  planCode: string;
  planName?: string;
  sequenceNo?: number;
  appCode: string;
  status: 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  totalCount: number;
  passCount: number;
  failCount: number;
  reviewCount: number;
  avgScore: number;
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
  query?: string;
  expectedBehavior?: string;
  requestJson?: Record<string, unknown>;
  responseJson?: Record<string, unknown>;
  finalAnswer: string;
  finalScore: number;
  passStatus: 'PASS' | 'FAIL' | 'REVIEW';
  failureReason?: string;
  problemType?: string;
  elapsedMs?: number;
  errorCode?: string;
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
  };
}

interface EvaluationConfigRecord {
  appCode: string;
  modelId: string;
  promptOverrideEnabled: boolean;
  systemPrompt: string;
  customPrompt: string;
  effectivePrompt: string;
}

interface JudgeModelRecord {
  id: string;
  modelName: string;
  providerCode: string;
  modelId: string;
  modelType: 'LLM' | 'EMBEDDING';
  protocol: string;
  parameters: Record<string, unknown>;
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

type ExecutionDataStore = {
  listCases(): Promise<ExecutionCaseRecord[] | null>;
  listRuns(): Promise<RunRecord[] | null>;
  findRun(runCode: string): Promise<RunRecord | null | undefined>;
  createRun(run: RunRecord): Promise<RunRecord | null>;
  updateRun(run: RunRecord): Promise<RunRecord | null>;
  createResult(result: ResultRecord, testCase: ExecutionCaseRecord): Promise<ResultRecord | null>;
  listResults(runCode: string): Promise<ResultRecord[] | null>;
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
  };
  appPresetCategory: {
    findMany(input?: { where?: object; orderBy?: object }): Promise<unknown[]>;
  };
};

const DEFAULT_HEADER_TEMPLATE = '{\n  "Content-Type": "application/json"\n}';
const DEFAULT_BODY_TEMPLATE = '{\n  "query": "{{case.query}}"\n}';
const DEFAULT_ANSWER_PATH = '$.data.content';
const DEFAULT_SUCCESS_EXPRESSION = '$.code == 0';
const DEFAULT_APP_PROTOCOL_TIMEOUT_MS = 30_000;
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
        status: run.status,
        totalCount: run.totalCount,
        passCount: run.passCount,
        failCount: run.failCount,
        reviewCount: run.reviewCount,
        warningCount: 0,
        blockedCount: 0,
        avgScore: run.avgScore,
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
        totalCount: run.totalCount,
        passCount: run.passCount,
        failCount: run.failCount,
        reviewCount: run.reviewCount,
        avgScore: run.avgScore,
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
        errorCode: result.errorCode ?? null,
      },
    });
    return this.toResult(saved);
  }

  async listResults(runCode: string): Promise<ResultRecord[] | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const rows = await prisma.evalResult.findMany({ where: { runCode }, orderBy: { id: 'asc' } });
    return rows.map((row) => this.toResult(row));
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
      totalCount: Number(data.totalCount ?? 0),
      passCount: Number(data.passCount ?? 0),
      failCount: Number(data.failCount ?? 0),
      reviewCount: Number(data.reviewCount ?? 0),
      avgScore: Number(data.avgScore?.toString?.() ?? data.avgScore ?? 0),
      startAt,
      endAt,
      durationMs,
    };
  }

  private normalizeRunStatus(value: unknown): RunRecord['status'] {
    if (value === 'RUNNING' || value === 'CANCELLED' || value === 'FAILED') return value;
    return 'COMPLETED';
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
    return {
      resultId: String(data.id ?? data.resultId),
      runCode: String(data.runCode),
      caseCode: String(data.caseId ?? data.caseCode),
      requestJson: this.asRecord(data.requestJson),
      responseJson: this.asRecord(data.responseJson),
      finalAnswer: String(data.finalAnswer ?? ''),
      finalScore: Number(data.finalScore?.toString?.() ?? data.finalScore ?? 0),
      passStatus: data.passStatus === 'FAIL' || data.passStatus === 'REVIEW' ? data.passStatus : 'PASS',
      failureReason: typeof data.failureReason === 'string' ? data.failureReason : undefined,
      problemType: typeof data.problemType === 'string' ? data.problemType : undefined,
      elapsedMs: data.elapsedMs === null || data.elapsedMs === undefined ? undefined : Number(data.elapsedMs),
      errorCode: typeof data.errorCode === 'string' ? data.errorCode : undefined,
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
      totalCount: cases.length,
      passCount: 0,
      failCount: 0,
      reviewCount: 0,
      avgScore: 0,
      startAt: startedAt,
      endAt: cases.length === 0 ? startedAt : undefined,
      durationMs: cases.length === 0 ? 0 : undefined,
    };
    const savedRun = await this.database.createRun(run);
    const nextRun = savedRun ?? run;
    this.runs.set(nextRun.runCode, nextRun);
    this.rememberRunOrder(nextRun.runCode);
    this.results.set(nextRun.runCode, []);
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
    const all = await this.getResultSource(runCode);
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

  async rerun(runCode: string): Promise<RunRecord> {
    const run = await this.getRun(runCode);
    return this.persistRun({ ...run, status: 'COMPLETED' });
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
      const app = cases.length > 0 ? await this.getApp(run.appCode) : undefined;
      const savedResults = await this.getResultSource(run.runCode);
      const completedCaseCodes = new Set(savedResults.map((result) => result.caseCode));

      for (const [index, testCase] of cases.entries()) {
        if (completedCaseCodes.has(testCase.id)) continue;

        const result = await this.executeRunCase(run.runCode, testCase, index, app);
        const savedResult = await this.database.createResult(result, testCase);
        const enrichedResult = this.enrichResult(savedResult ?? result, testCase);
        savedResults.push(enrichedResult);
        completedCaseCodes.add(testCase.id);
        this.results.set(run.runCode, [...savedResults]);
        await this.persistRun(this.summarizeRun(run, savedResults, 'RUNNING'));
      }
      await this.persistRun(this.summarizeRun(run, savedResults, 'COMPLETED'));
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

  private async executeRunCase(
    runCode: string,
    testCase: ExecutionCaseRecord,
    index: number,
    app: ExecutionAppRecord | undefined,
  ) {
    try {
      const judgeContext = await this.getJudgeContext(testCase.appCode);
      return this.executeCase(runCode, testCase, index, app, judgeContext);
    } catch (error) {
      return this.failedJudgeConfigResult(runCode, testCase, index, this.describeExecutionError(error));
    }
  }

  private failedJudgeConfigResult(runCode: string, testCase: ExecutionCaseRecord, index: number, failureReason: string): ResultRecord {
    return {
      ...this.failedResult(runCode, testCase, index, 'JUDGE_CONFIG_UNAVAILABLE', failureReason),
      problemType: '评估配置不可用',
    };
  }

  private summarizeRun(run: RunRecord, results: ResultRecord[], status: RunRecord['status']): RunRecord {
    const totalScore = results.reduce((sum, result) => sum + result.finalScore, 0);
    const endAt = status === 'RUNNING' ? undefined : new Date().toISOString();
    return {
      ...run,
      status,
      passCount: results.filter((result) => result.passStatus === 'PASS').length,
      failCount: results.filter((result) => result.passStatus === 'FAIL').length,
      reviewCount: results.filter((result) => result.passStatus === 'REVIEW').length,
      avgScore: results.length === 0 ? 0 : Math.round(totalScore / results.length),
      endAt,
      durationMs: run.startAt && endAt ? new Date(endAt).getTime() - new Date(run.startAt).getTime() : undefined,
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

  private async executeCase(
    runCode: string,
    testCase: ExecutionCaseRecord,
    index: number,
    app: ExecutionAppRecord | undefined,
    judgeContext: JudgeContext,
  ): Promise<ResultRecord> {
    if (!app) {
      return this.failedResult(runCode, testCase, index, 'APP_PROTOCOL_MISSING', '应用协议不存在，无法执行真实调用');
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
      const score = protocolPassed
        ? await this.evaluateAnswerWithJudge(judgeContext, testCase, finalAnswer)
        : this.scoreAnswer(finalAnswer, testCase.expectedBehavior, false);
      return {
        resultId: `${runCode}_RESULT_${index + 1}`,
        runCode,
        caseCode: testCase.id,
        caseName: testCase.caseName,
        query: testCase.query,
        expectedBehavior: testCase.expectedBehavior,
        requestJson,
        responseJson,
        finalAnswer,
        finalScore: score.finalScore,
        passStatus: score.passStatus,
        failureReason: score.failureReason,
        problemType: score.problemType,
        elapsedMs: Date.now() - startedAt,
        errorCode: score.errorCode ?? (protocolPassed ? undefined : `HTTP_${upstream.status}`),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '真实接口调用失败';
      return this.failedResult(runCode, testCase, index, 'EXECUTION_CALL_FAILED', message, Date.now() - startedAt);
    }
  }

  private failedResult(runCode: string, testCase: ExecutionCaseRecord, index: number, errorCode: string, failureReason: string, elapsedMs = 0): ResultRecord {
    return {
      resultId: `${runCode}_RESULT_${index + 1}`,
      runCode,
      caseCode: testCase.id,
      caseName: testCase.caseName,
      query: testCase.query,
      expectedBehavior: testCase.expectedBehavior,
      requestJson: {},
      responseJson: { error: failureReason },
      finalAnswer: '',
      finalScore: 0,
      passStatus: 'FAIL',
      failureReason,
      problemType: '接口调用失败',
      elapsedMs,
      errorCode,
    };
  }

  private scoreAnswer(finalAnswer: string, expectedBehavior: string, protocolPassed: boolean): EvaluationScore {
    if (!protocolPassed) {
      return {
        finalScore: 0,
        passStatus: 'FAIL' as const,
        failureReason: '应用接口调用未满足成功表达式',
        problemType: '接口调用失败',
      };
    }
    const expected = expectedBehavior.trim();
    if (!expected) {
      return {
        finalScore: 80,
        passStatus: 'REVIEW' as const,
        failureReason: '用例未配置期望回答，需人工确认',
        problemType: '期望回答缺失',
      };
    }
    if (finalAnswer.includes(expected)) {
      return {
        finalScore: 100,
        passStatus: 'PASS' as const,
        failureReason: '实际回答完整命中期望回答',
        problemType: undefined,
      };
    }
    const keywords = expected.split(/[，。；;,.、\s]+/u).map((item) => item.trim()).filter((item) => item.length >= 2);
    if (keywords.some((keyword) => finalAnswer.includes(keyword))) {
      return {
        finalScore: 90,
        passStatus: 'PASS' as const,
        failureReason: '实际回答命中期望回答关键词',
        problemType: undefined,
      };
    }
    return {
      finalScore: 40,
      passStatus: 'FAIL' as const,
      failureReason: '实际回答未命中期望回答关键词',
      problemType: '期望不匹配',
    };
  }

  private async evaluateAnswerWithJudge(
    judgeContext: JudgeContext,
    testCase: ExecutionCaseRecord,
    finalAnswer: string,
  ): Promise<EvaluationScore> {
    const judgeTimeoutMs = this.resolveJudgeTimeoutMs(judgeContext.model.parameters, finalAnswer);
    try {
      const response = await this.fetchWithTimeout(this.buildJudgeEndpoint(judgeContext.provider.baseUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${judgeContext.provider.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.buildJudgeRequestBody(judgeContext, testCase, finalAnswer)),
      }, judgeTimeoutMs);
      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = this.parseJsonObject(text, { rawText: text });
      const content = this.extractJudgeMessageContent(payload);
      return this.parseJudgeResult(content);
    } catch (error) {
      return {
        finalScore: 0,
        passStatus: 'FAIL',
        failureReason: this.describeJudgeFailure(error, judgeTimeoutMs),
        problemType: '评估调用失败',
        errorCode: 'JUDGE_EVALUATION_FAILED',
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
    const caseMap = new Map((await this.getCaseSource()).map((testCase) => [testCase.id, testCase]));
    return sourceResults.map((result) => this.enrichResult(result, caseMap.get(result.caseCode)));
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

  private enrichResult(result: ResultRecord, testCase?: ExecutionCaseRecord): ResultRecord {
    if (!testCase) return result;
    return {
      ...result,
      caseName: result.caseName ?? testCase.caseName,
      query: result.query ?? testCase.query,
      expectedBehavior: result.expectedBehavior ?? testCase.expectedBehavior,
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
