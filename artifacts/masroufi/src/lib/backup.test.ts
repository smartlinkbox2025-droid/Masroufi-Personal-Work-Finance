import 'fake-indexeddb/auto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closeDatabaseConnection,
  getAllData,
  getCategories,
  getExpenses,
  getIncomes,
  getPaymentMethods,
  initializeDatabase,
  replaceAllData,
  resetToCleanState,
  saveCategory,
  saveExpense,
  saveIncome,
  savePaymentMethod,
  saveProject,
} from '@/db/database';
import {
  BACKUP_APP,
  BACKUP_VERSION,
  createBackup,
  restoreBackup,
  validateBackupPayload,
} from './backup';
import { totalExpenses, totalIncome } from './calculations';
import type { Category, Expense, Income, PaymentMethod, Project } from '@/types/finance';

const projects: Project[] = ['a', 'b'].map((suffix, index) => ({
  id: `backup-project-${suffix}`,
  name: `مشروع ${suffix.toUpperCase()}`,
  startDate: '2026-09-01',
  contractValueHalalas: (index + 1) * 5000000,
  budgetHalalas: (index + 1) * 2000000,
  status: index === 0 ? 'active' : 'paused',
  notes: `ملاحظات المشروع ${suffix}`,
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
}));

const customCategory: Category = {
  id: 'backup-custom-category',
  name: 'تصنيف مخصص',
  scope: 'work',
  kind: 'expense',
  isVisible: false,
  isDefault: false,
};

const customMethod: PaymentMethod = {
  id: 'backup-custom-method',
  name: 'محفظة مخصصة',
  isVisible: false,
  isDefault: false,
};

const expenses: Expense[] = Array.from({ length: 10 }, (_, index) => ({
  id: `backup-expense-${index}`,
  amountHalalas: 10001 + index,
  date: `2026-09-${String(index + 1).padStart(2, '0')}`,
  scope: index < 5 ? 'work' : 'personal',
  categoryId: index < 5 ? customCategory.id : 'personal-food',
  projectId: index < 4 ? projects[index % 2].id : undefined,
  paymentMethodId: index < 5 ? customMethod.id : 'cash',
  description: `مصروف ${index}`,
  notes: `ملاحظة ${index}`,
  createdAt: `2026-09-${String(index + 1).padStart(2, '0')}T08:00:00.000Z`,
}));

const incomes: Income[] = Array.from({ length: 6 }, (_, index) => ({
  id: `backup-income-${index}`,
  amountHalalas: 50003 + index,
  date: `2026-09-${String(index + 11).padStart(2, '0')}`,
  scope: index < 3 ? 'work' : 'personal',
  category: index < 3 ? 'income-project-payment' : 'income-salary',
  projectId: index < 3 ? projects[index % 2].id : undefined,
  paymentMethodId: index < 3 ? customMethod.id : 'bank-account',
  description: `دخل ${index}`,
  notes: `ملاحظة دخل ${index}`,
  createdAt: `2026-09-${String(index + 11).padStart(2, '0')}T08:00:00.000Z`,
}));

beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('masroufi-local');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  await initializeDatabase();
  await Promise.all([
    ...projects.map(saveProject),
    saveCategory(customCategory),
    savePaymentMethod(customMethod),
    ...expenses.map(saveExpense),
    ...incomes.map(saveIncome),
  ]);
});

afterAll(async () => {
  await closeDatabaseConnection();
});

describe('النسخ الاحتياطي والاستعادة الآمنة', () => {
  it('ينشئ نسخة كاملة ببيانات وصفية وعدد سجلات صحيح ومبالغ Integer Halalas', async () => {
    const backup = await createBackup();
    expect(backup.app).toBe(BACKUP_APP);
    expect(backup.backupVersion).toBe(BACKUP_VERSION);
    expect(backup.schemaVersion).toBe(2);
    expect(backup.databaseVersion).toBe(2);
    expect(backup.data.expenses).toHaveLength(10);
    expect(backup.data.incomes).toHaveLength(6);
    expect(backup.data.projects).toHaveLength(2);
    expect(backup.data.expenses.every((item) => Number.isInteger(item.amountHalalas))).toBe(true);
    expect(validateBackupPayload(backup).valid).toBe(true);
  });

  it('ينفذ Backup ثم Delete ثم Restore باستعادة مطابقة بالهللة والعلاقات والبيانات المخصصة', async () => {
    const backup = await createBackup();
    const beforeIncome = totalIncome(backup.data.incomes);
    const beforeExpenses = totalExpenses(backup.data.expenses);
    await resetToCleanState();
    expect(await getExpenses()).toHaveLength(0);
    expect(await getIncomes()).toHaveLength(0);
    expect((await getCategories()).length).toBeGreaterThan(0);
    expect((await getPaymentMethods()).length).toBeGreaterThan(0);
    await restoreBackup(backup);
    const restored = await getAllData();
    expect(totalIncome(restored.incomes)).toBe(beforeIncome);
    expect(totalExpenses(restored.expenses)).toBe(beforeExpenses);
    expect(restored.projects).toEqual(backup.data.projects);
    expect(restored.categories.find((item) => item.id === customCategory.id)).toEqual(customCategory);
    expect(restored.paymentMethods.find((item) => item.id === customMethod.id)).toEqual(customMethod);
    expect(restored.expenses.find((item) => item.id === 'backup-expense-0')?.projectId).toBe(projects[0].id);
  });

  it.each([
    ['JSON root غير صالح', null],
    ['معرّف تطبيق خاطئ', { app: 'other' }],
    ['إصدار Backup غير مدعوم', { app: BACKUP_APP, backupVersion: 99 }],
  ])('يرفض %s', (_label, payload) => {
    expect(validateBackupPayload(payload).valid).toBe(false);
  });

  it('يرفض مبلغًا غير صحيح وعلاقة مشروع مكسورة دون تغيير البيانات الحالية', async () => {
    const before = await createBackup();
    const invalidAmount = structuredClone(before);
    invalidAmount.data.expenses[0].amountHalalas = 12.5;
    expect(validateBackupPayload(invalidAmount).valid).toBe(false);
    const brokenRelation = structuredClone(before);
    brokenRelation.data.expenses[0].projectId = 'missing-project';
    expect(validateBackupPayload(brokenRelation).valid).toBe(false);
    expect(await getAllData()).toEqual(before.data);
  });

  it('تلغي المعاملة متعددة Stores عند فشل كتابة مفاجئ ولا تترك استعادة جزئية', async () => {
    const before = await getAllData();
    const invalid = structuredClone(before);
    (invalid.expenses[0] as Expense & { uncloneable: () => void }).uncloneable = () => undefined;
    await expect(replaceAllData(invalid)).rejects.toBeDefined();
    expect(await getAllData()).toEqual(before);
  });
});