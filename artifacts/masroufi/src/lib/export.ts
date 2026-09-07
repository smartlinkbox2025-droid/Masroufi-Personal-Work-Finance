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
  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true, compression: true });
  downloadBlob(
    new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename,
  );
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