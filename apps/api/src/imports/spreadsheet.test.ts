import { describe, expect, it } from 'vitest';
import { detectFormat, parseSpreadsheet, writeCsv, writeXlsx } from './spreadsheet';

describe('spreadsheet', () => {
  it('đọc CSV có BOM, dấu chấm phẩy, ô có dấu phẩy trong ngoặc kép', async () => {
    const csv =
      '\uFEFFSKU;Tên sản phẩm;Giá bán\nA-1;"Áo thun; cotton";199.000\n\n;;\nB-2;Quần;250000\n';
    const r = await parseSpreadsheet(Buffer.from(csv, 'utf8'), 'sp.csv');
    expect(r.format).toBe('csv');
    expect(r.headers).toEqual(['SKU', 'Tên sản phẩm', 'Giá bán']);
    expect(r.rows).toEqual([
      ['A-1', 'Áo thun; cotton', '199.000'],
      ['B-2', 'Quần', '250000'],
    ]);
  });

  it('ghi rồi đọc lại XLSX (tiếng Việt, số)', async () => {
    const buf = await writeXlsx(
      ['SKU', 'Tên sản phẩm', 'Giá bán'],
      [['A-1', 'Đèn bàn gốm', 690000]],
      'Sản phẩm',
    );
    const r = await parseSpreadsheet(buf, 'sp.xlsx');
    expect(r.format).toBe('xlsx');
    expect(r.sheetName).toBe('Sản phẩm');
    expect(r.rows[0]).toEqual(['A-1', 'Đèn bàn gốm', '690000']);
  });

  it('CSV xuất ra có BOM và đọc lại được', async () => {
    const buf = writeCsv(['SKU', 'Mô tả'], [['A-1', 'có "ngoặc", dấu phẩy']]);
    expect(buf.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    const r = await parseSpreadsheet(buf, 'x.csv');
    expect(r.rows[0]).toEqual(['A-1', 'có "ngoặc", dấu phẩy']);
  });

  it('từ chối định dạng sai / file giả mạo / file rỗng', async () => {
    expect(() => detectFormat(Buffer.from('abc'), 'a.xlsx')).toThrow(/không hợp lệ/);
    expect(() => detectFormat(Buffer.from('abc'), 'a.xls')).toThrow(/97-2003/);
    expect(() => detectFormat(Buffer.from('abc'), 'a.pdf')).toThrow(/Chỉ hỗ trợ/);
    await expect(parseSpreadsheet(Buffer.from('SKU,Tên\n'), 'a.csv')).rejects.toThrow(
      /chưa có sản phẩm/,
    );
  });
});
