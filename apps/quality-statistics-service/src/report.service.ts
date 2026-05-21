import { createRuntimePrismaClient } from '@ai-quality-platform/shared-database';
import { pageResult } from '@ai-quality-platform/shared-http';

export interface ReportListRecord {
  reportCode: string;
  runCode: string;
  reportName: string;
  appCode: string;
  passRate: number;
  generatedAt: string;
}

export interface GenerateReportRequest {
  appCode: string;
  runCode: string;
  reportName?: string;
}

type StatisticsPrismaClient = {
  aiApp: { findMany(input?: object): Promise<unknown[]> };
  evalCase: { findMany(input?: object): Promise<unknown[]> };
  evalPlan: { findMany(input?: object): Promise<unknown[]> };
  evalRun: { findMany(input?: object): Promise<unknown[]>; findUnique(input: { where: { runCode: string } }): Promise<unknown | null> };
  evalReview: { findMany(input?: object): Promise<unknown[]> };
  evalReport: {
    findMany(input?: object): Promise<unknown[]>;
    findUnique(input: { where: { reportCode: string } }): Promise<unknown | null>;
    create(input: { data: object }): Promise<unknown>;
  };
};

class ReportDatabase {
  private readonly prismaPromise = this.createClient();

  /**
   * @author codex
   * Aggregates reporting data directly from MySQL business tables.
   */
  async dashboard() {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const [apps, cases, plans, runs, reviews] = await Promise.all([
      prisma.aiApp.findMany(),
      prisma.evalCase.findMany(),
      prisma.evalPlan.findMany(),
      prisma.evalRun.findMany(),
      prisma.evalReview.findMany(),
    ]);
    const completedRuns = runs.map((run) => this.asRecord(run)).filter((run) => run.status === 'COMPLETED');
    const avgPassRate =
      completedRuns.length === 0
        ? 0
        : Math.round(
            completedRuns.reduce((sum, run) => {
              const total = Number(run.totalCount ?? 0);
              const pass = Number(run.passCount ?? 0);
              return sum + (total > 0 ? (pass / total) * 100 : 0);
            }, 0) / completedRuns.length,
          );
    const pendingReviewCount = reviews.map((review) => this.asRecord(review)).filter((review) => review.reviewStatus === 'PENDING').length;
    const highRiskFailureCount = runs.map((run) => this.asRecord(run)).filter((run) => Number(run.failCount ?? 0) > 0).length;
    return {
      appCount: apps.length,
      caseCount: cases.length,
      planCount: plans.length,
      avgPassRate,
      pendingReviewCount,
      highRiskFailureCount,
    };
  }

  async listReports(): Promise<ReportListRecord[] | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const [reports, runs] = await Promise.all([
      prisma.evalReport.findMany({ orderBy: { id: 'desc' } }),
      prisma.evalRun.findMany(),
    ]);
    const runsByCode = new Map(runs.map((run) => {
      const row = this.asRecord(run);
      return [String(row.runCode), row];
    }));
    return reports.map((report) => this.toReport(report, runsByCode.get(String(this.asRecord(report).runCode))));
  }

  async detail(reportCode: string) {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const row = await prisma.evalReport.findUnique({ where: { reportCode } });
    if (!row) return null;
    const report = this.asRecord(row);
    return {
      ...this.toReport(row),
      summary: this.asRecord(report.summaryJson),
      categoryStats: Array.isArray(report.categoryStatsJson) ? report.categoryStatsJson : [],
      riskStats: Array.isArray(report.riskStatsJson) ? report.riskStatsJson : [],
      typicalFailures: Array.isArray(report.typicalFailuresJson) ? report.typicalFailuresJson : [],
      suggestions: typeof report.suggestion === 'string' && report.suggestion ? [report.suggestion] : [],
    };
  }

  async generate(request: GenerateReportRequest, summary: Record<string, unknown>): Promise<ReportListRecord | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const run = await prisma.evalRun.findUnique({ where: { runCode: request.runCode } });
    const runRow = run ? this.asRecord(run) : undefined;
    const reportCode = `REPORT_${request.runCode}_${Date.now()}`;
    const saved = await prisma.evalReport.create({
      data: {
        reportCode,
        runCode: request.runCode,
        reportName: request.reportName ?? `${request.runCode} 评估报告`,
        summaryJson: summary,
        categoryStatsJson: [],
        riskStatsJson: [],
        typicalFailuresJson: [],
        suggestion: '',
      },
    });
    return this.toReport(saved, runRow);
  }

  private async createClient() {
    if (process.env.VITEST) return null;
    return createRuntimePrismaClient<StatisticsPrismaClient>();
  }

  private toReport(row: unknown, run?: Record<string, unknown>): ReportListRecord {
    const data = this.asRecord(row);
    const generatedAt = data.generatedAt instanceof Date ? data.generatedAt.toISOString() : String(data.generatedAt ?? '');
    const total = Number(run?.totalCount ?? 0);
    const pass = Number(run?.passCount ?? 0);
    return {
      reportCode: String(data.reportCode),
      runCode: String(data.runCode),
      reportName: String(data.reportName),
      appCode: String(run?.appCode ?? ''),
      passRate: total > 0 ? Math.round((pass / total) * 100) : 0,
      generatedAt,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }
}

export class ReportService {
  private readonly database = new ReportDatabase();
  private readonly generatedReports = new Map<string, ReportListRecord>();

  /**
   * @author codex
   * Produces dashboard metrics from current database records only.
   */
  async dashboard() {
    return (
      (await this.database.dashboard()) ?? {
        appCount: 0,
        caseCount: 0,
        planCount: 0,
        avgPassRate: 0,
        pendingReviewCount: 0,
        highRiskFailureCount: 0,
      }
    );
  }

  async detail(reportCode: string) {
    const report = (await this.database.detail(reportCode)) ?? this.generatedReports.get(reportCode);
    if (!report) throw new Error('报告不存在');
    return {
      ...report,
      summary: 'summary' in report ? report.summary : await this.dashboard(),
      categoryStats: 'categoryStats' in report ? report.categoryStats : [],
      suggestions: 'suggestions' in report ? report.suggestions : [],
    };
  }

  async list(query: { appCode?: string; runCode?: string }, page: { currentPage: number; linesPerPage: number }) {
    const start = (page.currentPage - 1) * page.linesPerPage;
    const rows = ((await this.database.listReports()) ?? Array.from(this.generatedReports.values())).filter((report) => {
      const appMatched = !query.appCode || report.appCode === query.appCode;
      const runMatched = !query.runCode || report.runCode === query.runCode;
      return appMatched && runMatched;
    });
    return pageResult(rows.slice(start, start + page.linesPerPage), page.currentPage, page.linesPerPage, rows.length);
  }

  /**
   * @author codex
   * Generates an evaluation report snapshot from an execution run identifier.
   */
  async generate(request: GenerateReportRequest): Promise<ReportListRecord> {
    const summary = await this.dashboard();
    const saved = await this.database.generate(request, summary);
    const record =
      saved ??
      ({
        reportCode: `REPORT_${request.runCode}_${Date.now()}`,
        runCode: request.runCode,
        reportName: request.reportName ?? `${request.runCode} 评估报告`,
        appCode: request.appCode,
        passRate: 0,
        generatedAt: new Date().toISOString(),
      } satisfies ReportListRecord);
    this.generatedReports.set(record.reportCode, record);
    return record;
  }

  async exportReport(reportCode: string) {
    return {
      fileName: `${reportCode}.json`,
      content: await this.detail(reportCode),
    };
  }
}
