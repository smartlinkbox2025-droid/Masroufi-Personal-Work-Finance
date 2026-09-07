import * as XLSX from 'xlsx';
import { calculateProjectFinancials } from './projects';
import {
  aggregateExpenseCategories,
  aggregateExpenseProjects,
  aggregateIncomeCategories,
  aggregatePaymentMethods,
  calculateAnnualReport,
  calculatePeriodSummary,
  calculatePersonalReport,
  calculateProjectReport,
  calculateWorkReport,
  listPeriodTransactions,
  type ReportPeriod,
  type ReportSources,
} from './reports';

const SAR_PER_HALALA = 100;

function money(amountHalalas: number): number {
  return amountHalalas / SAR_PER_HALALA;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function safeFilename(value: string): string {
  return value.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'masroufi-report';
}

type ExcelValue = string | number;
type ExcelSheet = { name: string; rows: Array<Record<string, ExcelValue>> };

const EXCEL_COLORS = {
  primary: '2F8069',
  primaryDark: '1E594A',
  primarySoft: 'E9F4F0',
  white: 'FFFFFF',
  text: '18332B',
  border: 'D8E5E0',
  positive: '167D5C',
  negative: 'C53D3D',
};

const moneyHeaders = new Set([
  'القيمة', 'المبلغ', 'الدخل', 'المصروف', 'المصروفات', 'الصافي',
  'قيمة العقد', 'الميزانية', 'إجمالي المستلم', 'إجمالي المصروف',
  'المتبقي من العقد', 'المتبقي من الميزانية',
]);

const percentageHeaders = new Set(['النسبة']);

function displayLength(value: ExcelValue): number {
  return String(value ?? '').replace(/[\u0600-\u06ff]/g, 'aa').length;
}

function styleWorksheet(worksheet: XLSX.WorkSheet, rows: ExcelSheet['rows']): void {
  const headers = Object.keys(rows[0] ?? { البيان: '', القيمة: '' });
  const range = XLSX.utils.decode_range(worksheet['!ref'] ?? 'A1:A1');
  worksheet['!rtl'] = true;
  worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: range.e.c } }) };
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
  worksheet['!rows'] = [{ hpt: 28 }, ...rows.map(() => ({ hpt: 22 }))];
  worksheet['!cols'] = headers.map((header) => {
    const contentWidth = Math.max(header.length + 3, ...rows.map((row) => displayLength(row[header] ?? '')));
    return { wch: Math.min(42, Math.max(13, contentWidth + 2)) };
  });

  for (let column = 0; column <= range.e.c; column += 1) {
    const headerAddress = XLSX.utils.encode_cell({ r: 0, c: column });
    const headerCell = worksheet[headerAddress];
    if (headerCell) {
      headerCell.s = {
        font: { bold: true, color: { rgb: EXCEL_COLORS.white }, sz: 12 },
        fill: { patternType: 'solid', fgColor: { rgb: EXCEL_COLORS.primary } },
        alignment: { horizontal: 'center', vertical: 'center', readingOrder: 2, wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: EXCEL_COLORS.primaryDark } },
          bottom: { style: 'thin', color: { rgb: EXCEL_COLORS.primaryDark } },
          left: { style: 'thin', color: { rgb: EXCEL_COLORS.primaryDark } },
          right: { style: 'thin', color: { rgb: EXCEL_COLORS.primaryDark } },
        },
      };
    }
  }

  for (let rowIndex = 1; rowIndex <= range.e.r; rowIndex += 1) {
    for (let column = 0; column <= range.e.c; column += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: column });
      const cell = worksheet[address];
      if (!cell) continue;
      const header = headers[column];
      if (typeof cell.v === 'number' && moneyHeaders.has(header)) cell.z = '#,##0.00 "ر.س"';
      if (typeof cell.v === 'number' && percentageHeaders.has(header)) cell.z = '0.00%';
      const isNegative = typeof cell.v === 'number' && cell.v < 0;
      cell.s = {
        font: { color: { rgb: isNegative ? EXCEL_COLORS.negative : EXCEL_COLORS.text } },
        fill: { patternType: 'solid', fgColor: { rgb: rowIndex % 2 === 0 ? 'F7FAF9' : EXCEL_COLORS.white } },
        alignment: {
          horizontal: typeof cell.v === 'number' ? 'center' : 'right',
          vertical: 'center',
          readingOrder: 2,
          wrapText: true,
        },
        border: {
          bottom: { style: 'thin', color: { rgb: EXCEL_COLORS.border } },
          left: { style: 'thin', color: { rgb: EXCEL_COLORS.border } },
          right: { style: 'thin', color: { rgb: EXCEL_COLORS.border } },
        },
      };
    }
  }
}

function createWorkbook(sheets: ExcelSheet[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: 'تقارير مصروفي المالية',
    Subject: 'تقرير مالي مُصدّر من تطبيق مصروفي',
    Author: 'مصروفي',
    Company: 'مصروفي',
    CreatedDate: new Date(),
  };
  workbook.Workbook = { Views: [{ RTL: true }] };
  sheets.forEach(({ name, rows }) => {
    const normalizedRows = rows.length ? rows : [{ البيان: 'لا توجد بيانات', القيمة: '—' }];
    const worksheet = XLSX.utils.json_to_sheet(normalizedRows);
    styleWorksheet(worksheet, normalizedRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31));
  });
  return workbook;
}

function downloadWorkbook(workbook: XLSX.WorkBook, filename: string): void {
  const output = buildStyledExcelXlsx(workbook);
  const blobBytes = new Uint8Array(output.byteLength);
  blobBytes.set(output);
  downloadBlob(
    new Blob([blobBytes.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename,
  );
}

export function buildStyledExcelXlsx(workbook: XLSX.WorkBook): Uint8Array {
  const sheets = workbook.SheetNames.map((sheetName, index) => {
    const worksheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<ExcelValue[]>(worksheet, { header: 1, raw: true, defval: '' });
    const headers = (matrix[0] ?? []).map(String);
    const columnCount = Math.max(1, headers.length);
    const rowsXml = matrix.map((row, rowIndex) => {
      const cells = Array.from({ length: columnCount }, (_, columnIndex) => {
        const value = row[columnIndex] ?? '';
        const header = headers[columnIndex] ?? '';
        const styleId = excelXlsxStyleId(header, value, rowIndex);
        const ref = `${columnName(columnIndex + 1)}${rowIndex + 1}`;
        return typeof value === 'number'
          ? `<c r="${ref}" s="${styleId}"><v>${value}</v></c>`
          : `<c r="${ref}" s="${styleId}" t="inlineStr"><is><t>${escapeXml(String(value))}</t></is></c>`;
      }).join('');
      return `<row r="${rowIndex + 1}" ht="${rowIndex === 0 ? 28 : 22}" customHeight="1">${cells}</row>`;
    }).join('');
    const columnsXml = Array.from({ length: columnCount }, (_, columnIndex) => {
      const widthChars = Number(worksheet['!cols']?.[columnIndex]?.wch ?? 16);
      return `<col min="${columnIndex + 1}" max="${columnIndex + 1}" width="${Math.min(42, Math.max(13, widthChars))}" customWidth="1"/>`;
    }).join('');
    const lastRow = Math.max(1, matrix.length);
    const lastColumn = columnName(columnCount);
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${lastColumn}${lastRow}"/><sheetViews><sheetView showGridLines="0" rightToLeft="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="22"/><cols>${columnsXml}</cols><sheetData>${rowsXml}</sheetData><autoFilter ref="A1:${lastColumn}${lastRow}"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  });
  const parts: ZipPart[] = [
    { name: '[Content_Types].xml', content: contentTypesXml(sheets.length) },
    { name: '_rels/.rels', content: rootRelationshipsXml() },
    { name: 'docProps/core.xml', content: corePropertiesXml() },
    { name: 'docProps/app.xml', content: appPropertiesXml(workbook.SheetNames) },
    { name: 'xl/workbook.xml', content: workbookXml(workbook.SheetNames) },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelationshipsXml(sheets.length) },
    { name: 'xl/styles.xml', content: xlsxStylesXml() },
    ...sheets.map((content, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, content })),
  ];
  return zipStore(parts);
}

function excelXlsxStyleId(header: string, value: ExcelValue, rowIndex: number): number {
  if (rowIndex === 0) return 1;
  const stripe = rowIndex % 2 === 0 ? 'Even' : 'Odd';
  if (typeof value === 'number' && moneyHeaders.has(header)) return value < 0 ? (stripe === 'Even' ? 9 : 8) : (stripe === 'Even' ? 7 : 6);
  if (typeof value === 'number' && percentageHeaders.has(header)) return stripe === 'Even' ? 11 : 10;
  if (typeof value === 'number') return stripe === 'Even' ? 5 : 4;
  return stripe === 'Even' ? 3 : 2;
}

function columnName(column: number): string {
  let name = '';
  for (let value = column; value > 0; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  return name;
}

function xlsxStylesXml(): string {
  const fonts = `<fonts count="4"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><color rgb="FF18332B"/><sz val="10"/><name val="Arial"/></font><font><color rgb="FFC53D3D"/><sz val="10"/><name val="Arial"/></font></fonts>`;
  const fills = `<fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2F8069"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF7FAF9"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFDEEEE"/><bgColor indexed="64"/></patternFill></fill></fills>`;
  const border = `<border><left style="thin"><color rgb="FFD8E5E0"/></left><right style="thin"><color rgb="FFD8E5E0"/></right><bottom style="thin"><color rgb="FFD8E5E0"/></bottom><diagonal/></border>`;
  const borders = `<borders count="2"><border/><${border.slice(1)}</borders>`;
  const alignment = `<alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/>`;
  const headerAlignment = `<alignment horizontal="center" vertical="center" readingOrder="2" wrapText="1"/>`;
  const xfs = [
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>',
    `<xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyAlignment="1">${headerAlignment}</xf>`,
    `<xf numFmtId="0" fontId="2" fillId="3" borderId="1" applyAlignment="1">${alignment}</xf>`,
    `<xf numFmtId="0" fontId="2" fillId="4" borderId="1" applyAlignment="1">${alignment}</xf>`,
    `<xf numFmtId="0" fontId="2" fillId="3" borderId="1" applyAlignment="1">${alignment}</xf>`,
    `<xf numFmtId="0" fontId="2" fillId="4" borderId="1" applyAlignment="1">${alignment}</xf>`,
    `<xf numFmtId="164" fontId="2" fillId="3" borderId="1" applyAlignment="1">${alignment}</xf>`,
    `<xf numFmtId="164" fontId="2" fillId="4" borderId="1" applyAlignment="1">${alignment}</xf>`,
    `<xf numFmtId="164" fontId="3" fillId="3" borderId="1" applyAlignment="1">${alignment}</xf>`,
    `<xf numFmtId="164" fontId="3" fillId="5" borderId="1" applyAlignment="1">${alignment}</xf>`,
    `<xf numFmtId="165" fontId="2" fillId="3" borderId="1" applyAlignment="1">${alignment}</xf>`,
    `<xf numFmtId="165" fontId="2" fillId="4" borderId="1" applyAlignment="1">${alignment}</xf>`,
  ];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;ر.س&quot;"/><numFmt numFmtId="165" formatCode="0.00%"/></numFmts>${fonts}${fills}${borders}<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

function contentTypesXml(sheetCount: number): string {
  const overrides = Array.from({ length: sheetCount }, (_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${overrides}</Types>`;
}

function rootRelationshipsXml(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>';
}

function workbookXml(sheetNames: string[]): string {
  const sheets = sheetNames.map((name, index) => `<sheet name="${escapeXml(name.slice(0, 31))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><fileVersion appName="xl"/><workbookPr/><bookViews><workbookView xWindow="0" yWindow="0" rightToLeft="1"/></bookViews><sheets>${sheets}</sheets></workbook>`;
}

function workbookRelationshipsXml(sheetCount: number): string {
  const sheets = Array.from({ length: sheetCount }, (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets}<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function corePropertiesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>تقارير مصروفي المالية</dc:title><dc:creator>مصروفي</dc:creator><cp:lastModifiedBy>مصروفي</cp:lastModifiedBy></cp:coreProperties>`;
}

function appPropertiesXml(sheetNames: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>مصروفي</Application><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheetNames.length}</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="${sheetNames.length}" baseType="lpstr">${sheetNames.map((name) => `<vt:lpstr>${escapeXml(name)}</vt:lpstr>`).join('')}</vt:vector></TitlesOfParts></Properties>`;
}

type ZipPart = { name: string; content: string };

function zipStore(parts: ZipPart[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const part of parts) {
    const name = encoder.encode(part.name);
    const data = encoder.encode(part.content);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    writeZipHeader(local, 0x04034b50, 30, crc, data.length, data.length, name.length, 0);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    chunks.push(local);
    const entry = new Uint8Array(46 + name.length);
    writeZipHeader(entry, 0x02014b50, 46, crc, data.length, data.length, name.length, offset, true);
    entry.set(name, 46);
    central.push(entry);
    offset += local.length;
  }
  const centralOffset = offset;
  const centralSize = central.reduce((sum, entry) => sum + entry.length, 0);
  chunks.push(...central);
  const end = new Uint8Array(22);
  write32(end, 0, 0x06054b50);
  write16(end, 8, parts.length);
  write16(end, 10, parts.length);
  write32(end, 12, centralSize);
  write32(end, 16, centralOffset);
  chunks.push(end);
  const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let cursor = 0;
  for (const chunk of chunks) { result.set(chunk, cursor); cursor += chunk.length; }
  return result;
}

function writeZipHeader(buffer: Uint8Array, signature: number, _headerSize: number, crc: number, compressedSize: number, size: number, nameLength: number, offset = 0, central = false): void {
  write32(buffer, 0, signature);
  if (central) {
    write16(buffer, 4, 20);
    write16(buffer, 6, 20);
    write16(buffer, 8, 0x800);
    write16(buffer, 10, 0);
    write16(buffer, 12, 0);
    write16(buffer, 14, 0);
    write32(buffer, 16, crc);
    write32(buffer, 20, compressedSize);
    write32(buffer, 24, size);
    write16(buffer, 28, nameLength);
    write16(buffer, 30, 0);
    write16(buffer, 32, 0);
    write16(buffer, 34, 0);
    write16(buffer, 36, 0);
    write32(buffer, 38, 0);
    write32(buffer, 42, offset);
  } else {
    write16(buffer, 4, 20);
    write16(buffer, 6, 0x800);
    write16(buffer, 8, 0);
    write16(buffer, 10, 0);
    write16(buffer, 12, 0);
    write32(buffer, 14, crc);
    write32(buffer, 18, compressedSize);
    write32(buffer, 22, size);
    write16(buffer, 26, nameLength);
    write16(buffer, 28, 0);
  }
}

function write16(buffer: Uint8Array, offset: number, value: number): void { buffer[offset] = value & 0xff; buffer[offset + 1] = (value >>> 8) & 0xff; }
function write32(buffer: Uint8Array, offset: number, value: number): void { buffer[offset] = value & 0xff; buffer[offset + 1] = (value >>> 8) & 0xff; buffer[offset + 2] = (value >>> 16) & 0xff; buffer[offset + 3] = (value >>> 24) & 0xff; }
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[character] ?? character);
}

function exportWorkbook(sheets: ExcelSheet[], filename: string): void {
  downloadWorkbook(createWorkbook(sheets), filename);
}

function summaryRows(summary: ReturnType<typeof calculatePeriodSummary>, createdAt: string, projectCount: number) {
  return [
    { البيان: 'تاريخ إنشاء الملف', القيمة: createdAt },
    { البيان: 'إجمالي الدخل', القيمة: money(summary.totalIncome) },
    { البيان: 'إجمالي المصروفات', القيمة: money(summary.totalExpenses) },
    { البيان: 'صافي التدفق', القيمة: money(summary.net) },
    { البيان: 'دخل العمل', القيمة: money(summary.workIncome) },
    { البيان: 'مصروفات العمل', القيمة: money(summary.workExpenses) },
    { البيان: 'الدخل الشخصي', القيمة: money(summary.personalIncome) },
    { البيان: 'المصروفات الشخصية', القيمة: money(summary.personalExpenses) },
    { البيان: 'عدد المشاريع', القيمة: projectCount },
  ];
}

function allTimeSummary(sources: ReportSources) {
  const dates = [...sources.expenses, ...sources.incomes].map((item) => item.date).sort();
  const period: ReportPeriod = {
    from: dates[0] ?? '0000-01-01',
    to: dates.at(-1) ?? '9999-12-31',
    label: 'كل البيانات',
  };
  return calculatePeriodSummary(sources, period);
}

function expenseRows(sources: ReportSources, expenses = sources.expenses) {
  return expenses.map((item) => ({
    التاريخ: item.date,
    النوع: item.scope === 'work' ? 'عمل' : 'شخصي',
    التصنيف: sources.categories.find((category) => category.id === item.categoryId)?.name ?? 'غير متاح',
    المشروع: item.projectId ? sources.projects.find((project) => project.id === item.projectId)?.name ?? 'غير متاح' : '—',
    البيان: item.description ?? '—',
    'طريقة الدفع': item.paymentMethodId ? sources.paymentMethods.find((method) => method.id === item.paymentMethodId)?.name ?? 'غير متاح' : 'غير محدد',
    المبلغ: money(item.amountHalalas),
    الملاحظات: item.notes ?? '—',
  }));
}

function incomeRows(sources: ReportSources, incomes = sources.incomes) {
  return incomes.map((item) => ({
    التاريخ: item.date,
    النوع: item.scope === 'work' ? 'عمل' : 'شخصي',
    'التصنيف / المصدر': sources.categories.find((category) => category.id === item.category)?.name ?? 'غير متاح',
    المشروع: item.projectId ? sources.projects.find((project) => project.id === item.projectId)?.name ?? 'غير متاح' : '—',
    البيان: item.description ?? '—',
    'طريقة الاستلام': item.paymentMethodId ? sources.paymentMethods.find((method) => method.id === item.paymentMethodId)?.name ?? 'غير متاح' : 'غير محدد',
    المبلغ: money(item.amountHalalas),
    الملاحظات: item.notes ?? '—',
  }));
}

function projectRows(sources: ReportSources) {
  return sources.projects.map((project) => {
    const financials = calculateProjectFinancials(project, sources.incomes, sources.expenses);
    return {
      'اسم المشروع': project.name,
      العميل: project.client ?? '—',
      الموقع: project.location ?? '—',
      الحالة: project.status,
      'تاريخ البداية': project.startDate,
      'تاريخ النهاية': project.expectedEndDate ?? '—',
      'قيمة العقد': project.contractValueHalalas === undefined ? '—' : money(project.contractValueHalalas),
      الميزانية: project.budgetHalalas === undefined ? '—' : money(project.budgetHalalas),
      'إجمالي المستلم': money(financials.receivedIncome),
      'إجمالي المصروف': money(financials.expenses),
      'صافي التدفق': money(financials.cashFlow),
      'المتبقي من العقد': financials.contractRemaining === null ? '—' : money(financials.contractRemaining),
      'المتبقي من الميزانية': financials.remainingBudget === null ? '—' : money(financials.remainingBudget),
    };
  });
}

export function exportAllDataToExcel(sources: ReportSources): void {
  const summary = allTimeSummary(sources);
  exportWorkbook(
    [
      { name: 'الملخص', rows: summaryRows(summary, new Date().toISOString(), sources.projects.length) },
      { name: 'المصروفات', rows: expenseRows(sources) },
      { name: 'الدخل', rows: incomeRows(sources) },
      { name: 'المشاريع', rows: projectRows(sources) },
    ],
    `masroufi-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

function reportSummaryRows(sources: ReportSources, period: ReportPeriod) {
  return summaryRows(calculatePeriodSummary(sources, period), new Date().toISOString(), sources.projects.length);
}

export function exportMonthlyReportToExcel(sources: ReportSources, period: ReportPeriod): void {
  downloadWorkbook(
    buildMonthlyReportWorkbook(sources, period),
    `masroufi-monthly-${period.from}.xlsx`,
  );
}

export function buildMonthlyReportWorkbook(sources: ReportSources, period: ReportPeriod): XLSX.WorkBook {
  const transactions = listPeriodTransactions(sources, period);
  return createWorkbook([
      { name: 'الملخص', rows: reportSummaryRows(sources, period) },
      { name: 'المصروفات', rows: expenseRows(sources, sources.expenses.filter((item) => item.date >= period.from && item.date <= period.to)) },
      { name: 'الدخل', rows: incomeRows(sources, sources.incomes.filter((item) => item.date >= period.from && item.date <= period.to)) },
      { name: 'الحركات', rows: transactions.map((row) => ({ التاريخ: row.date, النوع: row.kind === 'income' ? 'دخل' : 'مصروف', النطاق: row.scope === 'work' ? 'عمل' : 'شخصي', التصنيف: row.categoryName, المشروع: row.projectName, البيان: row.description, المبلغ: money(row.amount) })) },
      { name: 'التصنيفات', rows: aggregateExpenseCategories(sources, period).map((row) => ({ التصنيف: row.name, 'عدد الحركات': row.count, المبلغ: money(row.amount), النسبة: row.percentage / 100 })) },
      { name: 'المشاريع', rows: aggregateExpenseProjects(sources, period).map((row) => ({ المشروع: row.name, 'عدد الحركات': row.count, المصروفات: money(row.expenses), الدخل: money(row.income), الصافي: money(row.net) })) },
      { name: 'طرق الدفع', rows: aggregatePaymentMethods(sources, period).map((row) => ({ الطريقة: row.name, 'عدد الحركات': row.count, المبلغ: money(row.amount), النسبة: row.percentage / 100 })) },
      { name: 'مصادر الدخل', rows: aggregateIncomeCategories(sources, period).map((row) => ({ المصدر: row.name, 'عدد الحركات': row.count, المبلغ: money(row.amount), النسبة: row.percentage / 100 })) },
    ]);
}

export function exportAnnualReportToExcel(sources: ReportSources, year: number): void {
  const report = calculateAnnualReport(sources, year);
  exportWorkbook(
    [
      { name: 'الملخص', rows: summaryRows(report.summary, new Date().toISOString(), sources.projects.length) },
      { name: 'الأشهر', rows: report.months.map((row) => ({ الشهر: row.label, الدخل: money(row.totalIncome), المصروف: money(row.totalExpenses), الصافي: money(row.net) })) },
    ],
    `masroufi-annual-${year}.xlsx`,
  );
}

export function exportWorkReportToExcel(sources: ReportSources, period: ReportPeriod): void {
  const report = calculateWorkReport(sources, period);
  const transactions = listPeriodTransactions(sources, period).filter((row) => row.scope === 'work');
  exportWorkbook(
    [
      { name: 'الملخص', rows: summaryRows(report.summary, new Date().toISOString(), report.activeProjects) },
      { name: 'المشاريع', rows: report.projectRows.map((row) => ({ المشروع: row.name, الدخل: money(row.income), المصروف: money(row.expenses), الصافي: money(row.net) })) },
      { name: 'الحركات', rows: transactions.map((row) => ({ التاريخ: row.date, النوع: row.kind === 'income' ? 'دخل' : 'مصروف', التصنيف: row.categoryName, المشروع: row.projectName, البيان: row.description, المبلغ: money(row.amount) })) },
    ],
    `masroufi-work-${period.from}-${period.to}.xlsx`,
  );
}

export function exportPersonalReportToExcel(sources: ReportSources, period: ReportPeriod): void {
  const report = calculatePersonalReport(sources, period);
  const transactions = listPeriodTransactions(sources, period).filter((row) => row.scope === 'personal');
  exportWorkbook(
    [
      { name: 'الملخص', rows: summaryRows(report.summary, new Date().toISOString(), 0) },
      { name: 'التصنيفات', rows: report.expenseCategories.map((row) => ({ التصنيف: row.name, 'عدد الحركات': row.count, المبلغ: money(row.amount), النسبة: row.percentage / 100 })) },
      { name: 'الحركات', rows: transactions.map((row) => ({ التاريخ: row.date, النوع: row.kind === 'income' ? 'دخل' : 'مصروف', التصنيف: row.categoryName, البيان: row.description, المبلغ: money(row.amount) })) },
    ],
    `masroufi-personal-${period.from}-${period.to}.xlsx`,
  );
}

export function exportProjectReportToExcel(sources: ReportSources, projectId: string): void {
  const report = calculateProjectReport(sources, projectId);
  if (!report) return;
  exportWorkbook(
    [
      { name: 'الملخص', rows: [
        { البيان: 'المشروع', القيمة: report.project.name },
        { البيان: 'العميل', القيمة: report.project.client ?? '—' },
        { البيان: 'قيمة العقد', القيمة: report.project.contractValueHalalas === undefined ? '—' : money(report.project.contractValueHalalas) },
        { البيان: 'الميزانية', القيمة: report.project.budgetHalalas === undefined ? '—' : money(report.project.budgetHalalas) },
        { البيان: 'إجمالي المستلم', القيمة: money(report.financials.receivedIncome) },
        { البيان: 'إجمالي المصروف', القيمة: money(report.financials.expenses) },
        { البيان: 'صافي التدفق', القيمة: money(report.financials.cashFlow) },
      ] },
      { name: 'الدخل', rows: incomeRows(sources, report.incomeRecords) },
      { name: 'المصروفات', rows: expenseRows(sources, report.expenseRecords) },
      { name: 'التصنيفات', rows: report.expenseCategories.map((row) => ({ التصنيف: row.name, 'عدد الحركات': row.count, المبلغ: money(row.amount), النسبة: row.percentage / 100 })) },
    ],
    `masroufi-project-${safeFilename(report.project.name)}.xlsx`,
  );
}