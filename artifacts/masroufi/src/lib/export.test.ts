import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildMonthlyReportWorkbook } from './export';
import { monthPeriod, type ReportSources } from './reports';

const sources: ReportSources = {
  expenses: [{
    id: 'expense-1',
    amountHalalas: 250075,
    date: '2026-08-10',
    scope: 'work',
    categoryId: 'materials',
    projectId: 'project-1',
    paymentMethodId: 'cash',
    description: 'مواد',
    createdAt: '2026-08-10T10:00:00.000Z',
  }],
  incomes: [{
    id: 'income-1',
    amountHalalas: 6000000,
    date: '2026-08-05',
    scope: 'work',
    category: 'payment',
    projectId: 'project-1',
    paymentMethodId: 'cash',
    description: 'دفعة',
    createdAt: '2026-08-05T10:00:00.000Z',
  }],
  projects: [{
    id: 'project-1',
    name: 'مشروع عمارة سكنية',
    startDate: '2026-08-01',
    status: 'active',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  }],
  categories: [
    { id: 'materials', name: 'مواد', scope: 'work', kind: 'expense', isVisible: true, isDefault: false },
    { id: 'payment', name: 'دفعة مشروع', scope: 'work', kind: 'income', isVisible: true, isDefault: false },
  ],
  paymentMethods: [{ id: 'cash', name: 'نقدي', isVisible: true, isDefault: true }],
};

describe('تصدير Excel للتقرير المحدد', () => {
  it('ينشئ Sheets المطلوبة ويحافظ على المبلغ كرقم وعلى إجماليات التقرير', () => {
    const workbook = buildMonthlyReportWorkbook(sources, monthPeriod(2026, 8));
    expect(workbook.SheetNames).toEqual([
      'الملخص', 'المصروفات', 'الدخل', 'الحركات',
      'التصنيفات', 'المشاريع', 'طرق الدفع', 'مصادر الدخل',
    ]);
    const summary = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets['الملخص']);
    const rows = Object.fromEntries(summary.map((row) => [row['البيان'], row['القيمة']]));
    expect(rows['إجمالي الدخل']).toBe(60000);
    expect(rows['إجمالي المصروفات']).toBe(2500.75);
    expect(rows['صافي التدفق']).toBe(57499.25);
    const expenseSheet = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets['المصروفات']);
    expect(expenseSheet).toHaveLength(1);
    expect(typeof expenseSheet[0]['المبلغ']).toBe('number');
    expect(expenseSheet[0]['المبلغ']).toBe(2500.75);
    expect(expenseSheet[0]['المشروع']).toBe('مشروع عمارة سكنية');
  });
});