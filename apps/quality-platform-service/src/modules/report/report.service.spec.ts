import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ReportService, type DashboardSnapshot, type ReportDataStore } from './report.service';

function createReportDataStore(snapshot: DashboardSnapshot): ReportDataStore {
  return {
    dashboardSnapshot: async () => snapshot,
  };
}

function createEmptyDashboardSnapshot(): DashboardSnapshot {
  return {
    apps: [],
    cases: [],
    plans: [],
    runs: [],
    results: [],
    reviews: [],
  };
}

describe('ReportService', () => {
  it('does not keep a production test-environment fallback branch', () => {
    const source = readFileSync(join(process.cwd(), 'src/modules/report/report.service.ts'), 'utf8');

    expect(source).not.toContain('process.env.VITEST');
    expect(source).not.toContain('Promise<DashboardSnapshot | null>');
    expect(source).not.toContain('if (!snapshot) return this.emptyDashboard()');
  });

  it('does not keep statistical default values for malformed source rows', () => {
    const source = readFileSync(join(process.cwd(), 'src/modules/report/report.service.ts'), 'utf8');

    expect(source).not.toContain('Number(run.totalCount ?? 0)');
    expect(source).not.toContain('Number(run.passCount ?? 0)');
    expect(source).not.toContain('Number(run.failCount ?? 0)');
    expect(source).not.toContain('Number(right.id ?? 0)');
    expect(source).not.toContain("String(review.resultId ?? '')");
  });

  it('returns empty dashboard metrics when no business data exists', async () => {
    const service = new ReportService(createReportDataStore(createEmptyDashboardSnapshot()));

    await expect(service.dashboard()).resolves.toMatchObject({
      appCount: 0,
      caseCount: 0,
      planCount: 0,
      avgPassRate: 0,
    });
  });

  it('counts pending reviews from current execution results instead of fake review rows', async () => {
    const service = new ReportService(createReportDataStore({
      apps: [{ id: 1 }],
      cases: [{ id: 1 }, { id: 2 }],
      plans: [{ id: 1 }],
      runs: [
        { status: 'COMPLETED', totalCount: 2, passCount: 1, failCount: 1 },
        { status: 'RUNNING', totalCount: 1, passCount: 0, failCount: 0 },
      ],
      results: [
        { id: 101, passStatus: 'REVIEW' },
        { id: 102, passStatus: 'REVIEW' },
        { id: 103, passStatus: 'PASS' },
      ],
      reviews: [
        { id: 1, resultId: 102, manualResult: 'PASS' },
        { id: 2, resultId: 103, manualResult: null },
      ],
    }));

    await expect(service.dashboard()).resolves.toMatchObject({
      appCount: 1,
      caseCount: 2,
      planCount: 1,
      avgPassRate: 50,
      pendingReviewCount: 1,
      failedRunCount: 1,
    });
  });

  it('rejects malformed execution run rows instead of counting them as zero', async () => {
    const service = new ReportService(createReportDataStore({
      apps: [],
      cases: [],
      plans: [],
      runs: [
        { status: 'COMPLETED', passCount: 1, failCount: 0 },
      ],
      results: [],
      reviews: [],
    }));

    await expect(service.dashboard()).rejects.toThrow('执行批次记录缺少总数');
  });

  it('rejects malformed manual review rows instead of ignoring empty result ids', async () => {
    const service = new ReportService(createReportDataStore({
      apps: [],
      cases: [],
      plans: [],
      runs: [],
      results: [
        { id: 101, passStatus: 'REVIEW' },
      ],
      reviews: [
        { id: 1, manualResult: 'PASS' },
      ],
    }));

    await expect(service.dashboard()).rejects.toThrow('人工复核记录缺少执行结果 ID');
  });
});
