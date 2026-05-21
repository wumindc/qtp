import { describe, expect, it } from 'vitest';
import { CaseExcelService } from './excel.service';

describe('CaseExcelService', () => {
  it('exports and imports full-field case rows as workbook buffers', () => {
    const service = new CaseExcelService();
    const rows = [
      {
        caseName: 'Excel 导入用例',
        appCode: 'demo_credit_assistant',
        categoryId: 'NORMAL_QA',
        riskLevel: 'LOW',
        query: '企业信用报告怎么查？',
        expectedBehavior: '正常回答',
        referenceAnswer: '通过官方渠道查询。',
        mustInclude: '信用报告',
        mustNotInclude: '保证通过',
        minScore: 80,
        manualReviewRequired: 'false',
        tags: 'Excel,演示',
      },
    ];

    const workbook = service.exportWorkbook(rows);
    const imported = service.importWorkbook(workbook);

    expect(Buffer.isBuffer(workbook)).toBe(true);
    expect(imported[0]?.caseName).toBe('Excel 导入用例');
    expect(imported[0]?.manualReviewRequired).toBe('false');
  });
});
