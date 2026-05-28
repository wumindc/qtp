import { createRuntimePrismaClient } from '@ai-quality-platform/shared-database';

type StatisticsPrismaClient = {
  aiApp: { findMany(input?: object): Promise<unknown[]> };
  evalCase: { findMany(input?: object): Promise<unknown[]> };
  evalPlan: { findMany(input?: object): Promise<unknown[]> };
  evalRun: { findMany(input?: object): Promise<unknown[]> };
  evalResult: { findMany(input?: object): Promise<unknown[]> };
  evalReview: { findMany(input?: object): Promise<unknown[]> };
};

export interface DashboardSnapshot {
  apps: unknown[];
  cases: unknown[];
  plans: unknown[];
  runs: unknown[];
  results: unknown[];
  reviews: unknown[];
}

export interface ReportDataStore {
  dashboardSnapshot(): Promise<DashboardSnapshot>;
}

interface DashboardRunRecord {
  status: string;
  totalCount: number;
  passCount: number;
  failCount: number;
}

interface DashboardResultRecord {
  id: string;
  passStatus: string;
}

interface DashboardReviewRecord {
  id: string;
  resultId: string;
  manualResult: unknown;
}

class ReportDatabase implements ReportDataStore {
  private readonly prismaPromise = this.createClient();

  /**
   * @author codex
   * Reads reporting source rows directly from MySQL business tables.
   */
  async dashboardSnapshot(): Promise<DashboardSnapshot> {
    const prisma = await this.prismaPromise;
    const [apps, cases, plans, runs, results, reviews] = await Promise.all([
      prisma.aiApp.findMany(),
      prisma.evalCase.findMany(),
      prisma.evalPlan.findMany(),
      prisma.evalRun.findMany(),
      prisma.evalResult.findMany(),
      prisma.evalReview.findMany(),
    ]);
    return { apps, cases, plans, runs, results, reviews };
  }

  private async createClient() {
    return createRuntimePrismaClient<StatisticsPrismaClient>();
  }
}

export class ReportService {
  constructor(private readonly database: ReportDataStore = new ReportDatabase()) {}

  /**
   * @author codex
   * Produces dashboard metrics from current database records only.
  */
  async dashboard() {
    const snapshot = await this.database.dashboardSnapshot();

    const runs = snapshot.runs.map((run) => this.toRunRecord(run));
    const completedRuns = runs.filter((run) => run.status === 'COMPLETED');
    const avgPassRate =
      completedRuns.length === 0
        ? 0
        : Math.round(
            completedRuns.reduce((sum, run) => sum + (run.totalCount > 0 ? (run.passCount / run.totalCount) * 100 : 0), 0) /
              completedRuns.length,
          );
    const latestReviews = this.latestManualReviews(snapshot.reviews);
    const pendingReviewCount = snapshot.results
      .map((result) => this.toResultRecord(result))
      .filter((result) => result.passStatus === 'REVIEW')
      .filter((result) => {
        const review = latestReviews.get(result.id);
        return review?.manualResult !== 'PASS' && review?.manualResult !== 'FAIL';
      }).length;
    const failedRunCount = runs.filter((run) => run.failCount > 0).length;

    return {
      appCount: snapshot.apps.length,
      caseCount: snapshot.cases.length,
      planCount: snapshot.plans.length,
      avgPassRate,
      pendingReviewCount,
      failedRunCount,
    };
  }

  private latestManualReviews(reviews: unknown[]) {
    const latest = new Map<string, DashboardReviewRecord>();
    for (const review of reviews.map((item) => this.toReviewRecord(item)).sort((left, right) => this.comparePersistedIdDesc(left.id, right.id))) {
      if (!latest.has(review.resultId)) latest.set(review.resultId, review);
    }
    return latest;
  }

  private toRunRecord(value: unknown): DashboardRunRecord {
    const data = this.readRecord(value, '执行批次记录格式不正确');
    return {
      status: this.readRequiredString(data.status, '执行批次记录缺少状态'),
      totalCount: this.readNonNegativeInteger(data.totalCount, '执行批次记录缺少总数'),
      passCount: this.readNonNegativeInteger(data.passCount, '执行批次记录缺少通过数'),
      failCount: this.readNonNegativeInteger(data.failCount, '执行批次记录缺少失败数'),
    };
  }

  private toResultRecord(value: unknown): DashboardResultRecord {
    const data = this.readRecord(value, '执行结果记录格式不正确');
    return {
      id: this.readPersistedId(data.id, '执行结果记录缺少 ID'),
      passStatus: this.readRequiredString(data.passStatus, '执行结果记录缺少通过状态'),
    };
  }

  private toReviewRecord(value: unknown): DashboardReviewRecord {
    const data = this.readRecord(value, '人工复核记录格式不正确');
    return {
      id: this.readPersistedId(data.id, '人工复核记录缺少 ID'),
      resultId: this.readPersistedId(data.resultId, '人工复核记录缺少执行结果 ID'),
      manualResult: data.manualResult,
    };
  }

  private readRecord(value: unknown, message: string): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    throw new Error(message);
  }

  private readRequiredString(value: unknown, message: string): string {
    if (typeof value === 'string' && value.trim()) return value;
    throw new Error(message);
  }

  private readNonNegativeInteger(value: unknown, message: string): number {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
    throw new Error(message);
  }

  private readPersistedId(value: unknown, message: string): string {
    if (typeof value === 'bigint' && value > 0n) return String(value);
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) return String(value);
    throw new Error(message);
  }

  private comparePersistedIdDesc(left: string, right: string): number {
    const leftId = BigInt(left);
    const rightId = BigInt(right);
    if (rightId > leftId) return 1;
    if (rightId < leftId) return -1;
    return 0;
  }
}
