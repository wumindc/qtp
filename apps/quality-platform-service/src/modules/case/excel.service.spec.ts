import { describe, expect, it } from 'vitest';
import { CaseExcelService } from './excel.service';

describe('CaseExcelService', () => {
  it('exports and imports minimal question case rows as workbook buffers', () => {
    const service = new CaseExcelService();
    const rows = [
      {
        appCode: 'credit_assistant',
        categoryId: 'NORMAL_QA',
        query: '企业信用报告怎么查？',
        expectedBehavior: '正常回答',
      },
    ];

    const workbook = service.exportWorkbook(rows);
    const imported = service.importWorkbook(workbook);

    expect(Buffer.isBuffer(workbook)).toBe(true);
    expect(imported[0]?.query).toBe('企业信用报告怎么查？');
    expect(imported[0]?.expectedBehavior).toBe('正常回答');
  });
});
