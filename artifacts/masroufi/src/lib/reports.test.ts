import { describe, expect, it } from 'vitest';
import type { Category, Expense, Income, PaymentMethod, Project } from '@/types/finance';
import {
  aggregateExpenseCategories, aggregateExpenseProjects, aggregatePaymentMethods,
  calculateAnnualReport, calculatePeriodSummary, calculatePersonalReport,
  calculateProjectReport, calculateWorkReport, comparePeriods, monthPeriod,
  type ReportSources,
} from './reports';

const categories: Category[] = [
  { id: 'materials', name: 'مواد', kind: 'expense', scope: 'work', isVisible: true, isDefault: true },
  { id: 'home', name: 'المنزل', kind: 'expense', scope: 'personal', isVisible: true, isDefault: true },
  { id: 'fuel', name: 'وقود', kind: 'expense', scope: 'personal', isVisible: true, isDefault: true },
  { id: 'shopping', name: 'تسوق', kind: 'expense', scope: 'personal', isVisible: true, isDefault: true },
  { id: 'project-income', name: 'دفعة مشروع', kind: 'income', scope: 'work', isVisible: true, isDefault: true },
  { id: 'salary', name: 'راتب', kind: 'income', scope: 'personal', isVisible: true, isDefault: true },
];
const paymentMethods: PaymentMethod[] = [{ id: 'cash', name: 'نقدي', isVisible: true, isDefault: true }];
const project: Project = { id: 'a', name: 'Project A', client: 'Client', location: 'Riyadh', startDate: '2026-01-01', status: 'active', contractValueHalalas: 50_000_000, budgetHalalas: 30_000_000, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
function expense(id: string, amount: number, date: string, scope: 'work' | 'personal', categoryId: string, projectId?: string, paymentMethodId?: string): Expense { return { id, amountHalalas: amount, date, scope, categoryId, projectId, paymentMethodId, createdAt: '2030-01-01T00:00:00Z' }; }
function income(id: string, amount: number, date: string, scope: 'work' | 'personal', category: string, projectId?: string): Income { return { id, amountHalalas: amount, date, scope, category, projectId, createdAt: '2030-01-01T00:00:00Z' }; }
function sources(expenses: Expense[], incomes: Income[]): ReportSources { return { expenses, incomes, projects: [project], categories, paymentMethods }; }

describe('محرك التقارير المركزي', () => {
  const augustExpenses = [
    expense('we', 2_000_000, '2026-08-15', 'work', 'materials', 'a', 'cash'),
    expense('pe', 500_000, '2026-08-20', 'personal', 'home'),
  ];
  const augustIncomes = [
    income('wi', 5_000_000, '2026-08-05', 'work', 'project-income', 'a'),
    income('pi', 1_000_000, '2026-08-07', 'personal', 'salary'),
  ];
  it('يطابق مجموعة أغسطس بالهللة ويقسم العمل والشخصي', () => {
    const value = calculatePeriodSummary(sources(augustExpenses, augustIncomes), monthPeriod(2026, 8));
    expect(value).toMatchObject({ totalIncome: 6_000_000, totalExpenses: 2_500_000, net: 3_500_000, workIncome: 5_000_000, workExpenses: 2_000_000, personalIncome: 1_000_000, personalExpenses: 500_000 });
    expect(value.workIncome - value.workExpenses).toBe(3_000_000);
    expect(value.personalIncome - value.personalExpenses).toBe(500_000);
  });
  it('يعتمد على transaction.date وليس createdAt', () => {
    expect(calculatePeriodSummary(sources([expense('d', 100, '2026-08-15', 'work', 'materials')], []), monthPeriod(2026, 8)).totalExpenses).toBe(100);
  });
  it('يقارن يوليو وأغسطس ويعالج المقام صفر دون NaN أو Infinity', () => {
    const current = calculatePeriodSummary(sources(augustExpenses, augustIncomes), monthPeriod(2026, 8));
    const july = calculatePeriodSummary(sources([expense('j', 2_000_000, '2026-07-01', 'work', 'materials')], [income('ji', 4_000_000, '2026-07-01', 'work', 'project-income')]), monthPeriod(2026, 7));
    expect(comparePeriods(current, july).income).toMatchObject({ difference: 2_000_000, percentage: 50 });
    expect(comparePeriods(current, july).expenses).toMatchObject({ difference: 500_000, percentage: 25 });
    const zero = calculatePeriodSummary(sources([], []), monthPeriod(2026, 6));
    expect(comparePeriods(current, zero).expenses.percentage).toBeNull();
  });
  it('يطابق مجموع 12 شهرًا الإجمالي السنوي', () => {
    const report = calculateAnnualReport(sources([...augustExpenses, expense('jan', 123, '2026-01-01', 'work', 'materials')], augustIncomes), 2026);
    expect(report.months.reduce((sum, row) => sum + row.totalExpenses, 0)).toBe(report.summary.totalExpenses);
    expect(report.months).toHaveLength(12);
  });
  it('لا يعرض أعلى شهر مصروفات لسنة تحتوي دخلًا فقط', () => {
    const report = calculateAnnualReport(sources([], [income('only-income', 100, '2026-04-01', 'personal', 'salary')]), 2026);
    expect(report.highestExpenseMonth).toBeNull();
    expect(report.lowestExpenseMonth).toBeNull();
    expect(report.highestIncomeMonth?.month).toBe(4);
  });
  it('لا يعرض أعلى شهر دخل لسنة تحتوي مصروفات فقط', () => {
    const report = calculateAnnualReport(sources([expense('only-expense', 100, '2026-05-01', 'personal', 'home')], []), 2026);
    expect(report.highestIncomeMonth).toBeNull();
    expect(report.highestExpenseMonth?.month).toBe(5);
  });
  it('يحسب تقرير العمل داخل الفترة فقط ويحفظ العمل العام منفصلًا', () => {
    const data = sources([expense('inside', 3_000_000, '2026-08-10', 'work', 'materials', 'a'), expense('general', 500_000, '2026-08-11', 'work', 'materials'), expense('outside', 7_000_000, '2026-07-01', 'work', 'materials', 'a')], []);
    const report = calculateWorkReport(data, monthPeriod(2026, 8));
    expect(report.projectRows[0].expenses).toBe(3_000_000);
    expect(report.generalExpenses).toBe(500_000);
    expect(report.summary.workExpenses).toBe(3_500_000);
  });
  it('لا يخلط المصروف الشخصي مع مصروفات العمل العامة', () => {
    const rows = aggregateExpenseProjects(sources([expense('general', 500, '2026-08-01', 'work', 'materials'), expense('personal', 900, '2026-08-01', 'personal', 'home')], []), monthPeriod(2026, 8));
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(500);
  });
  it('يحافظ تقرير المشروع على اتساق حسابات Phase 3', () => {
    const report = calculateProjectReport(sources([expense('e', 9_000_000, '2026-08-01', 'work', 'materials', 'a')], [income('i', 15_000_000, '2026-08-01', 'work', 'project-income', 'a')]), 'a')!;
    expect(report.financials).toMatchObject({ receivedIncome: 15_000_000, expenses: 9_000_000, cashFlow: 6_000_000, contractRemaining: 35_000_000, remainingBudget: 21_000_000, budgetUsagePercent: 30 });
  });
  it('يحسب التقرير الشخصي ونسب التصنيفات بدقة', () => {
    const data = sources([expense('h', 300_000, '2026-08-01', 'personal', 'home'), expense('f', 100_000, '2026-08-01', 'personal', 'fuel'), expense('s', 50_000, '2026-08-01', 'personal', 'shopping')], [income('p', 1_000_000, '2026-08-01', 'personal', 'salary')]);
    const report = calculatePersonalReport(data, monthPeriod(2026, 8));
    expect(report.summary.personalExpenses).toBe(450_000);
    expect(report.summary.personalIncome - report.summary.personalExpenses).toBe(550_000);
    expect(report.expenseCategories[0].percentage).toBeCloseTo(66.67, 2);
  });
  it('يجمع التصنيفات وطرق الدفع ويضع المفقود في غير محدد', () => {
    const data = sources([expense('a', 101, '2026-08-01', 'work', 'materials', undefined, 'cash'), expense('b', 202, '2026-08-02', 'work', 'materials')], []);
    expect(aggregateExpenseCategories(data, monthPeriod(2026, 8))[0]).toMatchObject({ count: 2, amount: 303 });
    expect(aggregatePaymentMethods(data, monthPeriod(2026, 8)).map((row) => row.name)).toContain('غير محدد');
  });
  it('لا يفقد هللة واحدة في الجمع والصافي', () => {
    const summary = calculatePeriodSummary(sources([expense('a', 1, '2026-08-01', 'work', 'materials'), expense('b', 2, '2026-08-01', 'personal', 'home')], [income('i', 10, '2026-08-01', 'personal', 'salary')]), monthPeriod(2026, 8));
    expect(summary.totalExpenses).toBe(3);
    expect(summary.net).toBe(7);
  });
});