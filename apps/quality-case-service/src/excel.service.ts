import * as XLSX from 'xlsx';

export type CaseExcelRow = Record<string, string | number | boolean | undefined>;

const SHEET_NAME = 'eval_cases';

export class CaseExcelService {
  /**
   * @author codex
   * Exports minimal question case rows into an XLSX workbook buffer.
   */
  exportWorkbook(rows: CaseExcelRow[]): Buffer {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME);
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  /**
   * @author codex
   * Imports the first worksheet from an XLSX workbook buffer.
   */
  importWorkbook(buffer: Buffer): CaseExcelRow[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    return XLSX.utils.sheet_to_json<CaseExcelRow>(workbook.Sheets[firstSheetName] ?? {});
  }
}
