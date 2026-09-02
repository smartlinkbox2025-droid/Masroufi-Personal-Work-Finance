import type { Expense, Income } from '@/types/finance';

export function sumHalalas(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}

export function totalExpenses(expenses: readonly Expense[]): number {
  return sumHalalas(expenses.map((expense) => expense.amountHalalas));
}

export function totalIncome(incomes: readonly Income[]): number {
  return sumHalalas(incomes.map((income) => income.amountHalalas));
}

export function netCashFlow(
  incomeHalalas: number,
  expenseHalalas: number,
): number {
  return incomeHalalas - expenseHalalas;
}