import { describe, expect, it } from 'vitest';
import { ReportService } from './report.service';

describe('ReportService', () => {
  it('returns empty dashboard metrics when no business data exists', async () => {
    const service = new ReportService();

    await expect(service.dashboard()).resolves.toMatchObject({
      appCount: 0,
      caseCount: 0,
      planCount: 0,
      avgPassRate: 0,
    });
  });

  it('lists no reports before generation', async () => {
    const service = new ReportService();

    const list = await service.list({}, { currentPage: 1, linesPerPage: 10 });
    expect(list.list).toHaveLength(0);
  });

  it('generates reports and filters generated records by app and run', async () => {
    const service = new ReportService();

    const generated = await service.generate({
      appCode: 'credit_assistant',
      runCode: 'SMOKE_RUN_9',
      reportName: '冒烟闭环报告',
    });

    expect(generated.reportCode).toContain('REPORT_SMOKE_RUN_9');
    expect((await service.list({ appCode: 'credit_assistant', runCode: 'SMOKE_RUN_9' }, { currentPage: 1, linesPerPage: 10 })).list).toHaveLength(1);
    const exported = await service.exportReport(generated.reportCode);
    expect(exported.fileName).toContain('.json');
    expect(exported.content.reportCode).toBe(generated.reportCode);
  });
});
