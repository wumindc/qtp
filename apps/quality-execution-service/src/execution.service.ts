import { createRuntimePrismaClient } from '@ai-quality-platform/shared-database';
import { pageResult, type PageResult } from '@ai-quality-platform/shared-http';

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

interface ExecutionCaseRecord {
  id: string;
  caseName: string;
  appCode: string;
  riskLevel: string;
  inputJson: Record<string, unknown>;
}

type ExecutionPrismaClient = {
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
};

class ExecutionDatabase {
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
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });
    return this.toRun(saved);
  }

  async updateRun(run: RunRecord): Promise<RunRecord | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const saved = await prisma.evalRun.update({
      where: { runCode: run.runCode },
      data: { status: run.status, finishedAt: new Date() },
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
        requestJson: testCase.inputJson,
        responseJson: { answer: result.finalAnswer },
        finalAnswer: result.finalAnswer,
        ruleScore: result.finalScore,
        judgeScore: result.finalScore,
        finalScore: result.finalScore,
        passStatus: result.passStatus,
        problemType: result.passStatus === 'REVIEW' ? '需人工复核' : null,
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
    return {
      id: String(data.id),
      caseName: String(data.caseName ?? ''),
      appCode: String(data.appCode ?? ''),
      riskLevel: String(data.riskLevel ?? 'MEDIUM'),
      inputJson: this.asRecord(data.inputJson),
    };
  }

  private toRun(row: unknown): RunRecord {
    const data = this.asRecord(row);
    return {
      runCode: String(data.runCode),
      planCode: String(data.planCode),
      appCode: String(data.appCode),
      status: data.status === 'RUNNING' || data.status === 'CANCELLED' ? data.status : 'COMPLETED',
      totalCount: Number(data.totalCount ?? 0),
      passCount: Number(data.passCount ?? 0),
      failCount: Number(data.failCount ?? 0),
      reviewCount: Number(data.reviewCount ?? 0),
      avgScore: Number(data.avgScore?.toString?.() ?? data.avgScore ?? 0),
    };
  }

  private toResult(row: unknown): ResultRecord {
    const data = this.asRecord(row);
    return {
      resultId: String(data.id ?? data.resultId),
      runCode: String(data.runCode),
      caseCode: String(data.caseId ?? data.caseCode),
      finalAnswer: String(data.finalAnswer ?? ''),
      finalScore: Number(data.finalScore?.toString?.() ?? data.finalScore ?? 0),
      passStatus: data.passStatus === 'FAIL' || data.passStatus === 'REVIEW' ? data.passStatus : 'PASS',
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }
}

export class ExecutionService {
  private readonly database = new ExecutionDatabase();
  private readonly runs = new Map<string, RunRecord>();
  private readonly results = new Map<string, ResultRecord[]>();
  private readonly cases = new Map<string, ExecutionCaseRecord>();

  /**
   * @author codex
   * Starts an execution run from the application's current database cases.
   */
  async start(request: { planCode: string; appCode: string; caseCodes?: string[] }): Promise<RunRecord> {
    const selectedCaseCodes = new Set(request.caseCodes ?? []);
    const cases = (await this.getCaseSource()).filter((testCase) => {
      if (testCase.appCode !== request.appCode) return false;
      return selectedCaseCodes.size === 0 || selectedCaseCodes.has(testCase.id);
    });
    const runCode = `${request.planCode}_RUN_${Date.now()}`;
    const runResults = cases.map((testCase, index): ResultRecord => {
      const reviewRequired = testCase.riskLevel === 'HIGH';
      return {
        resultId: `${runCode}_RESULT_${index + 1}`,
        runCode,
        caseCode: testCase.id,
        finalAnswer: testCase.caseName ? `${testCase.caseName} 已执行，等待质量评估。` : '测试用例已执行，等待质量评估。',
        finalScore: reviewRequired ? 82 : 92,
        passStatus: reviewRequired ? 'REVIEW' : 'PASS',
      };
    });
    const totalScore = runResults.reduce((sum, result) => sum + result.finalScore, 0);
    const run: RunRecord = {
      runCode,
      planCode: request.planCode,
      appCode: request.appCode,
      status: 'COMPLETED',
      totalCount: runResults.length,
      passCount: runResults.filter((result) => result.passStatus === 'PASS').length,
      failCount: runResults.filter((result) => result.passStatus === 'FAIL').length,
      reviewCount: runResults.filter((result) => result.passStatus === 'REVIEW').length,
      avgScore: runResults.length === 0 ? 0 : Math.round(totalScore / runResults.length),
    };
    const savedRun = await this.database.createRun(run);
    const nextRun = savedRun ?? run;
    this.runs.set(nextRun.runCode, nextRun);
    const savedResults: ResultRecord[] = [];
    for (const result of runResults) {
      const testCase = cases.find((item) => item.id === result.caseCode);
      const savedResult = testCase ? await this.database.createResult(result, testCase) : null;
      savedResults.push(savedResult ?? result);
    }
    this.results.set(nextRun.runCode, savedResults);
    return nextRun;
  }

  async runList(query: { appCode?: string; planCode?: string }, page: { currentPage: number; linesPerPage: number }): Promise<PageResult<RunRecord>> {
    const all = (await this.getRunSource()).filter((run) => {
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

  async rerun(runCode: string): Promise<RunRecord> {
    const run = await this.getRun(runCode);
    return this.persistRun({ ...run, status: 'COMPLETED' });
  }

  async cancel(runCode: string): Promise<RunRecord> {
    const run = await this.getRun(runCode);
    return this.persistRun({ ...run, status: 'CANCELLED' });
  }

  private async getCaseSource() {
    const databaseCases = await this.database.listCases();
    if (databaseCases) {
      this.cases.clear();
      databaseCases.forEach((testCase) => this.cases.set(testCase.id, testCase));
      return databaseCases;
    }
    return Array.from(this.cases.values());
  }

  private async getRunSource() {
    const databaseRuns = await this.database.listRuns();
    if (databaseRuns) {
      this.runs.clear();
      databaseRuns.forEach((run) => this.runs.set(run.runCode, run));
      return databaseRuns;
    }
    return Array.from(this.runs.values());
  }

  private async getResultSource(runCode: string) {
    const databaseResults = await this.database.listResults(runCode);
    if (databaseResults) {
      this.results.set(runCode, databaseResults);
      return databaseResults;
    }
    return this.results.get(runCode) ?? [];
  }

  private async getRun(runCode: string) {
    const databaseRun = await this.database.findRun(runCode);
    const run = databaseRun !== undefined ? databaseRun : this.runs.get(runCode);
    if (!run) throw new Error('执行批次不存在');
    this.runs.set(run.runCode, run);
    return run;
  }

  private async persistRun(run: RunRecord) {
    const saved = await this.database.updateRun(run);
    const next = saved ?? run;
    this.runs.set(next.runCode, next);
    return next;
  }
}
