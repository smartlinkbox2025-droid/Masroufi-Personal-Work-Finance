import type { Expense, Income, Project } from '@/types/finance';

export interface ProjectFinancials {
  receivedIncome: number;
  expenses: number;
  cashFlow: number;
  remainingBudget: number | null;
  budgetUsagePercent: number | null;
  budgetOverrun: number;
  contractRemaining: number | null;
  contractOverpayment: number;
}

export function calculateProjectFinancials(
  project: Project,
  incomes: readonly Income[],
  expenses: readonly Expense[],
): ProjectFinancials {
  const receivedIncome = incomes
    .filter((income) => income.projectId === project.id)
    .reduce((sum, income) => sum + income.amountHalalas, 0);
  const projectExpenses = expenses
    .filter((expense) => expense.projectId === project.id)
    .reduce((sum, expense) => sum + expense.amountHalalas, 0);
  const remainingBudget =
    project.budgetHalalas === undefined
      ? null
      : Math.max(project.budgetHalalas - projectExpenses, 0);
  const budgetOverrun =
    project.budgetHalalas === undefined
      ? 0
      : Math.max(projectExpenses - project.budgetHalalas, 0);
  const contractRemaining =
    project.contractValueHalalas === undefined
      ? null
      : Math.max(project.contractValueHalalas - receivedIncome, 0);
  const contractOverpayment =
    project.contractValueHalalas === undefined
      ? 0
      : Math.max(receivedIncome - project.contractValueHalalas, 0);

  return {
    receivedIncome,
    expenses: projectExpenses,
    cashFlow: receivedIncome - projectExpenses,
    remainingBudget,
    budgetUsagePercent:
      project.budgetHalalas && project.budgetHalalas > 0
        ? (projectExpenses * 100) / project.budgetHalalas
        : null,
    budgetOverrun,
    contractRemaining,
    contractOverpayment,
  };
}

export function projectStatusLabel(status: Project['status']): string {
  return {
    active: 'نشط',
    paused: 'متوقف',
    completed: 'مكتمل',
    archived: 'مؤرشف',
  }[status];
}