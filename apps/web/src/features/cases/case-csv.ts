/**
 * 用例 CSV 导入导出工具
 * @author codex
 */
export interface CaseCsvRow {
  categoryName: string;
  query: string;
  expectedBehavior: string;
}

const CASE_CSV_HEADERS = ['问题分类', '问题内容', '期望回答'] as const;

const HEADER_TO_FIELD: Record<string, keyof CaseCsvRow> = {
  问题分类: 'categoryName',
  问题内容: 'query',
  期望回答: 'expectedBehavior',
};

export function parseCaseCsv(content: string): CaseCsvRow[] {
  const table = parseCsvTable(content.replace(/^\ufeff/u, ''));
  if (table.length === 0) return [];
  const headers = table[0]?.map((cell) => cell.trim()) ?? [];
  const missingHeaders = CASE_CSV_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`CSV 缺少必需列：${missingHeaders.join('、')}`);
  }
  const fieldIndexes = CASE_CSV_HEADERS.map((header) => ({
    field: HEADER_TO_FIELD[header],
    index: headers.indexOf(header),
  }));

  return table.slice(1).flatMap((cells) => {
    if (cells.every((cell) => !cell.trim())) return [];
    const row = {
      categoryName: '',
      query: '',
      expectedBehavior: '',
    };
    fieldIndexes.forEach(({ field, index }) => {
      row[field] = cells[index]?.trim() ?? '';
    });
    return [row];
  });
}

export function formatCaseCsv(rows: CaseCsvRow[]): string {
  const lines = [
    CASE_CSV_HEADERS.join(','),
    ...rows.map((row) => [row.categoryName, row.query, row.expectedBehavior].map(formatCsvCell).join(',')),
  ];
  return lines.join('\n');
}

export function buildCaseCsvTemplate() {
  return formatCaseCsv([]);
}

export function buildCaseExportFilename(label: string, date = new Date()) {
  const safeLabel = label.trim().replace(/[\\/:*?"<>|]+/g, '_') || '用例导出';
  return `${safeLabel}_${formatCaseTimestamp(date)}.csv`;
}

export function downloadCaseCsv(filename: string, content: string) {
  const blob = new Blob([`\ufeff${content}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function readCaseCsvFile(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('读取 CSV 文件失败'));
    reader.readAsText(file);
  });
}

function formatCsvCell(value: string) {
  const normalized = value ?? '';
  if (!/[",\n\r]/u.test(normalized)) return normalized;
  return `"${normalized.replace(/"/g, '""')}"`;
}

function formatCaseTimestamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function parseCsvTable(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];
    if (quoted) {
      if (char === '"' && nextChar === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  row.push(cell);
  if (row.length > 1 || row.some((value) => value.trim())) {
    rows.push(row);
  }
  return rows;
}
