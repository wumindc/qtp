import { describe, expect, it } from 'vitest';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

describe('ReportController', () => {
  it('exposes report generate endpoint', async () => {
    const controller = new ReportController(new ReportService());

    const generated = await controller.generate({
      appCode: 'credit_assistant',
      runCode: 'SMOKE_RUN_10',
      reportName: '接口生成报告',
    });

    expect(generated.data.reportCode).toContain('REPORT_SMOKE_RUN_10');
    expect((await controller.list({
      page: { currentPage: 1, linesPerPage: 10 },
      data: { appCode: 'credit_assistant', runCode: 'SMOKE_RUN_10' },
    })).list).toHaveLength(1);
  });
});
