import { calculateProjectFinancials, type ProjectFinancials } from './projects';
import { netCashFlow } from './calculations';
import type { Category, Expense, Income, PaymentMethod, Project } from '@/types/finance';

export interface ReportSources {
  expenses: readonly Expense[];
  incomes: readonly Income[];
  projects: readonly Project[];
  categories: readonly Category[];
  paymentMethods: readonly PaymentMethod[];
}

export interface ReportPeriod {
  from: string;
  to: string;
  label: string;
}

export interface PeriodSummary {
  totalIncome: number;
  totalExpenses: number;
  net: number;
  workIncome: number;
  workExpenses: number;
  personalIncome: number;
  personalExpenses: number;
  incomeCount: number;
  expenseCount: number;
}

export interface BreakdownRow {
  id: string;
  name: string;
  count: number;
  amount: number;
  percentage: number;
  typeLabel?: string;
}

export interface ProjectBreakdownRow extends BreakdownRow {
  income: number;
  expenses: number;
  net: number;
}

export interface ReportTransaction {
  id: string;
  date: string;
  kind: 'income' | 'expense';
  scope: 'work' | 'personal';
  categoryName: string;
  projectName: string;
  description: string;
  methodName: string;
  amount: number;
  createdAt: string;
}

export interface AnnualReport {
  year: number;
  months: Array<PeriodSummary & { month: number; label: string }>;
  summary: PeriodSummary;
  averageIncome: number;
  averageExpenses: number;
  highestExpenseMonth: (PeriodSummary & { month: number; label: string }) | null;
  lowestExpenseMonth: (PeriodSummary & { month: number; label: string }) | null;
  highestIncomeMonth: (PeriodSummary & { month: number; label: string }) | null;
  topExpenseCategory: BreakdownRow | null;
}

export interface ProjectReport {
  project: Project;
  financials: ProjectFinancials;
  expenseRecords: Expense[];
  incomeRecords: Income[];
  expenseCategories: BreakdownRow[];
  transactions: ReportTransaction[];
}

const MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

export function monthPeriod(year: number, month: number): ReportPeriod {
  const monthText = String(month).padStart(2, '0');
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${monthText}-01`, to: `${year}-${monthText}-${String(lastDay).padStart(2, '0')}`, label: monthLabel(year, month) };
}

export function currentMonthPeriod(today = new Date()): ReportPeriod {
  return monthPeriod(today.getFullYear(), today.getMonth() + 1);
}

export function previousMonthPeriod(period: ReportPeriod): ReportPeriod {
  const [year, month] = period.from.split('-').map(Number);
  return monthPeriod(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);
}

export function nextMonthPeriod(period: ReportPeriod): ReportPeriod {
  const [year, month] = period.from.split('-').map(Number);
  return monthPeriod(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1);
}

export function periodFromDates(from: string, to: string): ReportPeriod | null {
  if (!from || !to || from > to) return null;
  return { from, to, label: `${formatDateOnly(from)} — ${formatDateOnly(to)}` };
}

export function calculatePeriodSummary(sources: ReportSources, period: ReportPeriod): PeriodSummary {
  const incomes = sources.incomes.filter((item) => inPeriod(item.date, period));
  const expenses = sources.expenses.filter((item) => inPeriod(item.date, period));
  const workIncome = sum(incomes.filter((item) => item.scope === 'work'));
  const workExpenses = sum(expenses.filter((item) => item.scope === 'work'));
  const personalIncome = sum(incomes.filter((item) => item.scope === 'personal'));
  const personalExpenses = sum(expenses.filter((item) => item.scope === 'personal'));
  const totalIncome = workIncome + personalIncome;
  const totalExpenses = workExpenses + personalExpenses;
  return { totalIncome, totalExpenses, net: netCashFlow(totalIncome, totalExpenses), workIncome, workExpenses, personalIncome, personalExpenses, incomeCount: incomes.length, expenseCount: expenses.length };
}

export function aggregateExpenseCategories(sources: ReportSources, period: ReportPeriod, scope?: 'work' | 'personal'): BreakdownRow[] {
  const expenses = sources.expenses.filter((item) => inPeriod(item.date, period) && (!scope || item.scope === scope));
  const rows = new Map<string, { count: number; amount: number }>();
  expenses.forEach((item) => {
    const current = rows.get(item.categoryId) ?? { count: 0, amount: 0 };
    rows.set(item.categoryId, { count: current.count + 1, amount: current.amount + item.amountHalalas });
  });
  const total = sum(expenses);
  return [...rows.entries()].map(([id, value]) => {
    const category = sources.categories.find((item) => item.id === id);
    return { id, name: category?.name ?? 'تصنيف غير متاح', ...value, percentage: percentage(value.amount, total), typeLabel: scopeLabel(category?.scope) };
  }).sort((a, b) => b.amount - a.amount);
}

export function aggregateIncomeCategories(sources: ReportSources, period: ReportPeriod, scope?: 'work' | 'personal'): BreakdownRow[] {
  const incomes = sources.incomes.filter((item) => inPeriod(item.date, period) && (!scope || item.scope === scope));
  const rows = new Map<string, { count: number; amount: number }>();
  incomes.forEach((item) => {
    const current = rows.get(item.category) ?? { count: 0, amount: 0 };
    rows.set(item.category, { count: current.count + 1, amount: current.amount + item.amountHalalas });
  });
  const total = sum(incomes);
  return [...rows.entries()].map(([id, value]) => {
    const category = sources.categories.find((item) => item.id === id);
    return { id, name: category?.name ?? 'مصدر غير متاح', ...value, percentage: percentage(value.amount, total), typeLabel: scopeLabel(category?.scope) };
  }).sort((a, b) => b.amount - a.amount);
}

export function aggregateExpenseProjects(sources: ReportSources, period: ReportPeriod): ProjectBreakdownRow[] {
  const expenses = sources.expenses.filter((item) => inPeriod(item.date, period) && item.scope === 'work');
  const map = new Map<string, { count: number; amount: number }>();
  expenses.forEach((item) => {
    const id = item.projectId ?? 'general-work';
    const current = map.get(id) ?? { count: 0, amount: 0 };
    map.set(id, { count: current.count + 1, amount: current.amount + item.amountHalalas });
  });
  const incomeByProject = new Map<string, number>();
  sources.incomes.filter((item) => inPeriod(item.date, period) && item.projectId).forEach((item) => incomeByProject.set(item.projectId!, (incomeByProject.get(item.projectId!) ?? 0) + item.amountHalalas));
  const total = sum(expenses);
  return [...map.entries()].map(([id, value]) => {
    const income = incomeByProject.get(id) ?? 0;
    return { id, name: id === 'general-work' ? 'مصروفات عمل عامة — بدون مشروع' : sources.projects.find((item) => item.id === id)?.name ?? 'مشروع غير متاح', ...value, expenses: value.amount, income, net: income - value.amount, percentage: percentage(value.amount, total) };
  }).sort((a, b) => b.amount - a.amount);
}

export function aggregatePaymentMethods(sources: ReportSources, period: ReportPeriod): BreakdownRow[] {
  const expenses = sources.expenses.filter((item) => inPeriod(item.date, period));
  const rows = new Map<string, { count: number; amount: number }>();
  expenses.forEach((item) => {
    const id = item.paymentMethodId ?? 'unspecified';
    const current = rows.get(id) ?? { count: 0, amount: 0 };
    rows.set(id, { count: current.count + 1, amount: current.amount + item.amountHalalas });
  });
  const total = sum(expenses);
  return [...rows.entries()].map(([id, value]) => ({ id, name: id === 'unspecified' ? 'غير محدد' : sources.paymentMethods.find((item) => item.id === id)?.name ?? 'غير محدد', ...value, percentage: percentage(value.amount, total) })).sort((a, b) => b.amount - a.amount);
}

export function listPeriodTransactions(sources: ReportSources, period: ReportPeriod): ReportTransaction[] {
  const expenses = sources.expenses.filter((item) => inPeriod(item.date, period)).map((item) => toReportTransaction(item, sources));
  const incomes = sources.incomes.filter((item) => inPeriod(item.date, period)).map((item) => toReportTransaction(item, sources));
  return [...incomes, ...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function comparePeriods(current: PeriodSummary, previous: PeriodSummary) {
  return {
    income: comparison(current.totalIncome, previous.totalIncome),
    expenses: comparison(current.totalExpenses, previous.totalExpenses),
    net: comparison(current.net, previous.net),
  };
}

export function calculateProjectPeriodTotals(sources: ReportSources, period: ReportPeriod) {
  const income = sum(sources.incomes.filter((item) => item.projectId && inPeriod(item.date, period)));
  const expenses = sum(sources.expenses.filter((item) => item.projectId && inPeriod(item.date, period)));
  return { income, expenses, net: income - expenses };
}

export function calculateAnnualReport(sources: ReportSources, year: number): AnnualReport {
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return { ...calculatePeriodSummary(sources, monthPeriod(year, month)), month, label: monthLabel(year, month) };
  });
  const summary = months.reduce((total, item) => addSummaries(total, item), emptySummary());
  const withExpenses = months.filter((item) => item.totalExpenses > 0);
  const withIncome = months.filter((item) => item.totalIncome > 0);
  const top = aggregateExpenseCategories(sources, { from: `${year}-01-01`, to: `${year}-12-31`, label: String(year) })[0] ?? null;
  return { year, months, summary, averageIncome: summary.totalIncome / 12, averageExpenses: summary.totalExpenses / 12, highestExpenseMonth: maxBy(withExpenses, (item) => item.totalExpenses), lowestExpenseMonth: minBy(withExpenses, (item) => item.totalExpenses), highestIncomeMonth: maxBy(withIncome, (item) => item.totalIncome), topExpenseCategory: top };
}

export function calculateWorkReport(sources: ReportSources, period: ReportPeriod) {
  const summary = calculatePeriodSummary(sources, period);
  const expenses = sources.expenses.filter((item) => inPeriod(item.date, period) && item.scope === 'work');
  const incomes = sources.incomes.filter((item) => inPeriod(item.date, period) && item.scope === 'work');
  const projectIds = new Set([...expenses, ...incomes].map((item) => item.projectId).filter(Boolean));
  const projectRows = sources.projects.filter((project) => projectIds.has(project.id)).map((project) => {
    const income = sum(incomes.filter((item) => item.projectId === project.id));
    const projectExpenses = sum(expenses.filter((item) => item.projectId === project.id));
    return { id: project.id, name: project.name, income, expenses: projectExpenses, net: income - projectExpenses };
  }).sort((a, b) => b.expenses - a.expenses);
  return { summary, workNet: summary.workIncome - summary.workExpenses, projectRows, projectExpenses: sum(expenses.filter((item) => item.projectId)), generalExpenses: sum(expenses.filter((item) => !item.projectId)), activeProjects: projectIds.size };
}

export function calculatePersonalReport(sources: ReportSources, period: ReportPeriod) {
  const summary = calculatePeriodSummary(sources, period);
  return { summary, personalNet: summary.personalIncome - summary.personalExpenses, expenseCategories: aggregateExpenseCategories(sources, period, 'personal') };
}

export function calculateProjectReport(sources: ReportSources, projectId: string): ProjectReport | null {
  const project = sources.projects.find((item) => item.id === projectId);
  if (!project) return null;
  const expenses = sources.expenses.filter((item) => item.projectId === projectId).sort((a, b) => b.date.localeCompare(a.date));
  const incomes = sources.incomes.filter((item) => item.projectId === projectId).sort((a, b) => b.date.localeCompare(a.date));
  return { project, financials: calculateProjectFinancials(project, sources.incomes, sources.expenses), expenseRecords: expenses, incomeRecords: incomes, expenseCategories: aggregateProjectCategories(expenses, sources.categories), transactions: listProjectTransactions(expenses, incomes, sources) };
}

export function inPeriod(date: string, period: ReportPeriod): boolean {
  return date >= period.from && date <= period.to;
}

function aggregateProjectCategories(expenses: Expense[], categories: readonly Category[]): BreakdownRow[] {
  const map = new Map<string, { count: number; amount: number }>();
  expenses.forEach((item) => { const current = map.get(item.categoryId) ?? { count: 0, amount: 0 }; map.set(item.categoryId, { count: current.count + 1, amount: current.amount + item.amountHalalas }); });
  const total = sum(expenses);
  return [...map.entries()].map(([id, value]) => ({ id, name: categories.find((item) => item.id === id)?.name ?? 'تصنيف غير متاح', ...value, percentage: percentage(value.amount, total) })).sort((a, b) => b.amount - a.amount);
}

function listProjectTransactions(expenses: Expense[], incomes: Income[], sources: ReportSources): ReportTransaction[] {
  return [...expenses.map((item) => toReportTransaction(item, sources)), ...incomes.map((item) => toReportTransaction(item, sources))].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function toReportTransaction(item: Expense | Income, sources: ReportSources): ReportTransaction {
  const isExpense = 'categoryId' in item;
  const categoryId = isExpense ? item.categoryId : item.category;
  return { id: item.id, date: item.date, kind: isExpense ? 'expense' : 'income', scope: item.scope, categoryName: sources.categories.find((category) => category.id === categoryId)?.name ?? 'غير متاح', projectName: item.projectId ? sources.projects.find((project) => project.id === item.projectId)?.name ?? 'غير متاح' : '—', description: item.description ?? '—', methodName: item.paymentMethodId ? sources.paymentMethods.find((method) => method.id === item.paymentMethodId)?.name ?? 'غير متاح' : 'غير محدد', amount: item.amountHalalas, createdAt: item.createdAt };
}

function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function sum(records: readonly { amountHalalas: number }[]): number {
  return records.reduce((total, item) => total + item.amountHalalas, 0);
}

function percentage(amount: number, total: number): number {
  return total === 0 ? 0 : (amount * 100) / total;
}

function comparison(current: number, previous: number) {
  return { current, previous, difference: current - previous, percentage: previous === 0 ? null : ((current - previous) * 100) / Math.abs(previous) };
}

function emptySummary(): PeriodSummary { return { totalIncome: 0, totalExpenses: 0, net: 0, workIncome: 0, workExpenses: 0, personalIncome: 0, personalExpenses: 0, incomeCount: 0, expenseCount: 0 }; }
function addSummaries(a: PeriodSummary, b: PeriodSummary): PeriodSummary { return { totalIncome: a.totalIncome + b.totalIncome, totalExpenses: a.totalExpenses + b.totalExpenses, net: a.net + b.net, workIncome: a.workIncome + b.workIncome, workExpenses: a.workExpenses + b.workExpenses, personalIncome: a.personalIncome + b.personalIncome, personalExpenses: a.personalExpenses + b.personalExpenses, incomeCount: a.incomeCount + b.incomeCount, expenseCount: a.expenseCount + b.expenseCount }; }
function maxBy<T>(items: T[], value: (item: T) => number): T | null { return items.reduce<T | null>((best, item) => !best || value(item) > value(best) ? item : best, null); }
function minBy<T>(items: T[], value: (item: T) => number): T | null { return items.reduce<T | null>((best, item) => !best || value(item) < value(best) ? item : best, null); }
function scopeLabel(scope?: Category['scope']): string { return scope === 'work' ? 'عمل' : scope === 'personal' ? 'شخصي' : 'عمل وشخصي'; }