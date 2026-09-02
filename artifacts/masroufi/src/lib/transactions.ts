import type { Category, Expense, FinanceScope, Income, PaymentMethod, Project } from '@/types/finance';

export interface TransactionFilters {
  query: string;
  fromDate: string;
  toDate: string;
  scope: FinanceScope | 'all';
  categoryId: string;
  projectId: string;
  paymentMethodId: string;
}

export const EMPTY_TRANSACTION_FILTERS: TransactionFilters = {
  query: '',
  fromDate: '',
  toDate: '',
  scope: 'all',
  categoryId: '',
  projectId: '',
  paymentMethodId: '',
};

export function todayISO(): string {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function formatArabicDate(value: string): string {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ar-SA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function isProjectSelectable(
  project: Project,
  mode: 'create' | 'edit' | 'duplicate',
  currentProjectId?: string,
): boolean {
  return project.status !== 'archived' ||
    (mode === 'edit' && project.id === currentProjectId);
}

function includesQuery(values: Array<string | undefined>, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase('ar');
  if (!normalizedQuery) return true;
  return values.some((value) =>
    value?.toLocaleLowerCase('ar').includes(normalizedQuery),
  );
}

function matchesDate(date: string, filters: TransactionFilters): boolean {
  return (
    (!filters.fromDate || date >= filters.fromDate) &&
    (!filters.toDate || date <= filters.toDate)
  );
}

export function filterExpenses(
  expenses: readonly Expense[],
  filters: TransactionFilters,
  categories: readonly Category[],
  methods: readonly PaymentMethod[],
  projects: readonly Project[],
): Expense[] {
  return expenses
    .filter((expense) => {
      const category = categories.find((item) => item.id === expense.categoryId);
      const method = methods.find((item) => item.id === expense.paymentMethodId);
      const project = projects.find((item) => item.id === expense.projectId);
      return (
        matchesDate(expense.date, filters) &&
        (filters.scope === 'all' || expense.scope === filters.scope) &&
        (!filters.categoryId || expense.categoryId === filters.categoryId) &&
        (!filters.projectId || expense.projectId === filters.projectId) &&
        (!filters.paymentMethodId || expense.paymentMethodId === filters.paymentMethodId) &&
        includesQuery(
          [expense.description, expense.notes, category?.name, project?.name],
          filters.query,
        )
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function filterIncomes(
  incomes: readonly Income[],
  filters: TransactionFilters,
  categories: readonly Category[],
  methods: readonly PaymentMethod[],
  projects: readonly Project[],
): Income[] {
  return incomes
    .filter((income) => {
      const category = categories.find((item) => item.id === income.category);
      const method = methods.find((item) => item.id === income.paymentMethodId);
      const project = projects.find((item) => item.id === income.projectId);
      return (
        matchesDate(income.date, filters) &&
        (filters.scope === 'all' || income.scope === filters.scope) &&
        (!filters.categoryId || income.category === filters.categoryId) &&
        (!filters.projectId || income.projectId === filters.projectId) &&
        (!filters.paymentMethodId || income.paymentMethodId === filters.paymentMethodId) &&
        includesQuery(
          [income.description, income.notes, category?.name, project?.name, method?.name],
          filters.query,
        )
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}