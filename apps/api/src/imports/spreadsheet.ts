import { parse as parseCsv } from 'csv-parse/sync';
import { stringify as stringifyCsv } from 'csv-stringify/sync';
import ExcelJS from 'exceljs';
import { AppError, IMPORT_MAX_ROWS } from '@acs/shared';

export type SheetFormat = 'csv' | 'xlsx';

export interface ParsedSheet {
  format: SheetFormat;
  sheetName: string | null;
  headers: string[];
  rows: string[][];
}

const MAX_COLUMNS = 200;
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/** Xác định định dạng theo NỘI DUNG (xlsx là file zip), không chỉ theo đuôi file. */
export function detectFormat(buffer: Buffer, filename: string): SheetFormat {
  const lower = filename.toLowerCase();
  const isZip = buffer.subarray(0, 4).equals(ZIP_MAGIC);
  if (lower.endsWith('.xlsx')) {
    if (!isZip) throw new AppError('VALIDATION_ERROR', 'File .xlsx không hợp lệ hoặc bị hỏng');
    return 'xlsx';
  }
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    if (isZip) throw new AppError('VALIDATION_ERROR', 'Nội dung file không phải CSV');
    return 'csv';
  }
  if (lower.endsWith('.xls')) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Định dạng .xls (Excel 97-2003) không hỗ trợ – hãy lưu lại thành .xlsx',
    );
  }
  throw new AppError('VALIDATION_ERROR', 'Chỉ hỗ trợ file .xlsx hoặc .csv');
}

function finalize(raw: string[][]): { headers: string[]; rows: string[][] } {
  const cleaned = raw
    .map((r) => r.slice(0, MAX_COLUMNS).map((c) => (c ?? '').toString().trim()))
    .filter((r) => r.some((c) => c !== ''));
  if (cleaned.length === 0) throw new AppError('VALIDATION_ERROR', 'File không có dữ liệu');
  const [headers, ...rows] = cleaned as [string[], ...string[][]];
  if (headers.every((h) => !h))
    throw new AppError('VALIDATION_ERROR', 'Không tìm thấy dòng tiêu đề');
  if (rows.length === 0)
    throw new AppError('VALIDATION_ERROR', 'File chỉ có dòng tiêu đề, chưa có sản phẩm');
  if (rows.length > IMPORT_MAX_ROWS) {
    throw new AppError(
      'VALIDATION_ERROR',
      `File có ${rows.length} dòng – tối đa ${IMPORT_MAX_ROWS} dòng mỗi lần`,
    );
  }
  const width = headers.length;
  return {
    headers,
    rows: rows.map((r) => Array.from({ length: Math.max(width, r.length) }, (_, i) => r[i] ?? '')),
  };
}

function detectDelimiter(firstLine: string): string {
  const candidates = [',', ';', '\t'];
  return candidates.reduce(
    (best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best),
    ',',
  );
}

export async function parseSpreadsheet(buffer: Buffer, filename: string): Promise<ParsedSheet> {
  const format = detectFormat(buffer, filename);
  if (format === 'csv') {
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    if (text.includes('\uFFFD')) {
      throw new AppError(
        'VALIDATION_ERROR',
        'File CSV không phải mã hoá UTF-8 – hãy lưu lại dạng "CSV UTF-8"',
      );
    }
    let records: string[][];
    try {
      records = parseCsv(text, {
        delimiter: detectDelimiter(text.split(/\r?\n/, 1)[0] ?? ''),
        relax_column_count: true,
        relax_quotes: true,
        skip_empty_lines: true,
      }) as string[][];
    } catch (error) {
      throw new AppError('VALIDATION_ERROR', `Không đọc được CSV: ${(error as Error).message}`);
    }
    return { format, sheetName: null, ...finalize(records) };
  }

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new AppError(
      'VALIDATION_ERROR',
      'Không đọc được file Excel – file có thể bị hỏng hoặc có mật khẩu',
    );
  }
  const sheet = wb.worksheets[0];
  if (!sheet) throw new AppError('VALIDATION_ERROR', 'File Excel không có sheet nào');
  const raw: string[][] = [];
  const columns = Math.min(sheet.columnCount, MAX_COLUMNS);
  sheet.eachRow({ includeEmpty: false }, (row) => {
    if (raw.length > IMPORT_MAX_ROWS + 1) return;
    raw.push(Array.from({ length: columns }, (_, i) => row.getCell(i + 1).text ?? ''));
  });
  return { format, sheetName: sheet.name, ...finalize(raw) };
}

/** CSV UTF-8 có BOM để Excel hiển thị đúng tiếng Việt. */
export function writeCsv(headers: string[], rows: (string | number | null)[][]): Buffer {
  const body = stringifyCsv([
    headers,
    ...rows.map((r) => r.map((c) => (c === null ? '' : String(c)))),
  ]);
  return Buffer.concat([Buffer.from('\uFEFF', 'utf8'), Buffer.from(body, 'utf8')]);
}

export async function writeXlsx(
  headers: string[],
  rows: (string | number | null)[][],
  sheetName: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AI CONTENT STUDIO';
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  for (const row of rows) ws.addRow(row.map((c) => (c === null ? '' : c)));
  headers.forEach((h, i) => {
    const longest = Math.max(h.length, ...rows.slice(0, 200).map((r) => String(r[i] ?? '').length));
    ws.getColumn(i + 1).width = Math.min(60, Math.max(10, longest + 2));
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
