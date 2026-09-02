import { describe, expect, it } from 'vitest';
import { calculateProjectFinancials } from './projects';
import { isProjectSelectable } from './transactions';
import type { Expense, Income, Project } from '@/types/finance';

function project(values: Partial<Project> = {}): Project {
  return { id: 'a', name: 'مشروع', startDate: '2026-01-01', status: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...values };
}
function expense(id: string, projectId: string | undefined, amountHalalas: number): Expense {
  return { id, projectId, amountHalalas, date: '2026-01-01', scope: projectId ? 'work' : 'personal', categoryId: 'work-materials', createdAt: '2026-01-01T00:00:00Z' };
}
function income(id: string, projectId: string | undefined, amountHalalas: number): Income {
  return { id, projectId, amountHalalas, date: '2026-01-01', scope: projectId ? 'work' : 'personal', category: 'income-project-payment', createdAt: '2026-01-01T00:00:00Z' };
}

describe('حسابات المشاريع المركزية', () => {
  it('يحسب مشروع A دون اعتبار قيمة العقد دخلًا', () => {
    const value = calculateProjectFinancials(project({ contractValueHalalas: 50_000_000, budgetHalalas: 30_000_000 }), [income('i', 'a', 15_000_000)], [expense('e', 'a', 9_000_000)]);
    expect(value).toMatchObject({ receivedIncome: 15_000_000, expenses: 9_000_000, cashFlow: 6_000_000, contractRemaining: 35_000_000, remainingBudget: 21_000_000, budgetUsagePercent: 30 });
  });
  it('يعرض تجاوز ميزانية مشروع B دون متبق سالب', () => {
    const value = calculateProjectFinancials(project({ budgetHalalas: 10_000_000 }), [], [expense('e', 'a', 11_500_000)]);
    expect(value.budgetUsagePercent).toBe(115);
    expect(value.budgetOverrun).toBe(1_500_000);
    expect(value.remainingBudget).toBe(0);
  });
  it('يعرض زيادة التحصيل في مشروع C دون متبق سالب', () => {
    const value = calculateProjectFinancials(project({ contractValueHalalas: 10_000_000 }), [income('i', 'a', 11_000_000)], []);
    expect(value.contractRemaining).toBe(0);
    expect(value.contractOverpayment).toBe(1_000_000);
  });
  it('يعالج مشروع D بلا ميزانية دون NaN أو Infinity', () => {
    const value = calculateProjectFinancials(project(), [], []);
    expect(value.remainingBudget).toBeNull();
    expect(value.budgetUsagePercent).toBeNull();
  });
  it('يحدّث المشروعين عند نقل الحركة ثم يزيلها عند تحويلها لشخصية', () => {
    const a = project({ id: 'a' }); const b = project({ id: 'b' });
    const linkedA = expense('e', 'a', 1_000_000);
    expect(calculateProjectFinancials(a, [], [linkedA]).expenses).toBe(1_000_000);
    expect(calculateProjectFinancials(b, [], [linkedA]).expenses).toBe(0);
    const linkedB = { ...linkedA, projectId: 'b' };
    expect(calculateProjectFinancials(a, [], [linkedB]).expenses).toBe(0);
    expect(calculateProjectFinancials(b, [], [linkedB]).expenses).toBe(1_000_000);
    const personal = { ...linkedB, scope: 'personal' as const, projectId: undefined };
    expect(calculateProjectFinancials(a, [], [personal]).expenses).toBe(0);
    expect(calculateProjectFinancials(b, [], [personal]).expenses).toBe(0);
  });
  it('يسمح بالمشروع المؤرشف الحالي أثناء التعديل فقط', () => {
    const archived = project({ id: 'archived', status: 'archived' });
    expect(isProjectSelectable(archived, 'create')).toBe(false);
    expect(isProjectSelectable(archived, 'duplicate', archived.id)).toBe(false);
    expect(isProjectSelectable(archived, 'edit', archived.id)).toBe(true);
    expect(isProjectSelectable(archived, 'edit', 'different')).toBe(false);
  });
});