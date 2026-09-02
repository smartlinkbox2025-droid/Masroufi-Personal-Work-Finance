import 'fake-indexeddb/auto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closeDatabaseConnection,
  deleteExpense,
  deleteIncome,
  getCategories,
  getDatabase,
  getExpenses,
  getIncomes,
  getPaymentMethods,
  initializeDatabase,
  saveExpense,
  saveIncome,
  saveProject,
} from '@/db/database';
import { netCashFlow, totalExpenses, totalIncome } from '@/lib/calculations';
import {
  EMPTY_TRANSACTION_FILTERS,
  filterExpenses,
  filterIncomes,
} from '@/lib/transactions';
import type { Expense, Income, Project } from '@/types/finance';

const expenseA: Expense = {
  id: 'expense-a',
  amountHalalas: 125075,
  date: '2026-08-10',
  scope: 'work',
  categoryId: 'work-materials',
  projectId: 'project-test',
  paymentMethodId: 'cash',
  description: 'مواد موقع',
  notes: 'فاتورة مواد',
  createdAt: '2026-08-10T10:00:00.000Z',
};

const expenseB: Expense = {
  id: 'expense-b',
  amountHalalas: 34925,
  date: '2026-08-15',
  scope: 'personal',
  categoryId: 'personal-food',
  paymentMethodId: 'card',
  description: 'مشتريات منزلية',
  createdAt: '2026-08-15T10:00:00.000Z',
};

const incomeA: Income = {
  id: 'income-a',
  amountHalalas: 500000,
  date: '2026-08-11',
  scope: 'work',
  category: 'income-project-payment',
  projectId: 'project-test',
  paymentMethodId: 'bank-transfer',
  description: 'دفعة المشروع',
  createdAt: '2026-08-11T10:00:00.000Z',
};

const incomeB: Income = {
  id: 'income-b',
  amountHalalas: 250050,
  date: '2026-08-16',
  scope: 'personal',
  category: 'income-salary',
  paymentMethodId: 'bank-account',
  description: 'راتب',
  createdAt: '2026-08-16T10:00:00.000Z',
};

const project: Project = {
  id: 'project-test',
  name: 'مشروع الاختبار',
  startDate: '2026-08-01',
  status: 'active',
  createdAt: '2026-08-01T10:00:00.000Z',
};

beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('masroufi-local');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('masroufi-local', 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      ['expenses', 'incomes', 'projects', 'categories', 'paymentMethods', 'settings'].forEach(
        (store) => database.createObjectStore(store, { keyPath: 'id' }),
      );
      request.transaction?.objectStore('categories').put({
        id: 'work-materials',
        name: 'مواد',
        scope: 'work',
        isVisible: true,
        isDefault: true,
      });
      request.transaction?.objectStore('categories').put({
        id: 'personal-food',
        name: 'غذاء',
        scope: 'personal',
        isVisible: true,
        isDefault: true,
      });
      request.transaction?.objectStore('settings').put({
        id: 'app',
        schemaVersion: 1,
        currency: 'SAR',
        locale: 'ar-SA',
        theme: 'system',
      });
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
  await initializeDatabase();
  await saveProject(project);
});

afterAll(async () => {
  await closeDatabaseConnection();
});

describe('دورة بيانات IndexedDB الفعلية', () => {
  it('يرقّي schema 1 إلى 2 ويحافظ على التصنيفات القديمة', async () => {
    const categories = await getCategories();
    expect(categories.find((item) => item.id === 'work-materials')?.kind).toBe('expense');
    expect(categories.some((item) => item.kind === 'income')).toBe(true);

    const database = await getDatabase();
    const settings = await new Promise<{ schemaVersion: number }>((resolve, reject) => {
      const request = database.transaction('settings', 'readonly').objectStore('settings').get('app');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(settings.schemaVersion).toBe(2);
  });

  it('ينشئ ويقرأ ويحدّث ويحذف مصروفًا', async () => {
    const record = { ...expenseA, id: 'expense-crud' };
    await saveExpense(record);
    expect((await getExpenses()).find((item) => item.id === record.id)?.amountHalalas).toBe(125075);

    await saveExpense({ ...record, amountHalalas: 130000 });
    expect((await getExpenses()).find((item) => item.id === record.id)?.amountHalalas).toBe(130000);

    await deleteExpense(record.id);
    expect((await getExpenses()).some((item) => item.id === record.id)).toBe(false);
  });

  it('ينشئ ويقرأ ويحدّث ويحذف دخلًا', async () => {
    const record = { ...incomeA, id: 'income-crud' };
    await saveIncome(record);
    expect((await getIncomes()).find((item) => item.id === record.id)?.amountHalalas).toBe(500000);

    await saveIncome({ ...record, amountHalalas: 525000 });
    expect((await getIncomes()).find((item) => item.id === record.id)?.amountHalalas).toBe(525000);

    await deleteIncome(record.id);
    expect((await getIncomes()).some((item) => item.id === record.id)).toBe(false);
  });

  it('يحافظ على بيانات الاختبار ودقة الإجماليات بالهللات', async () => {
    await Promise.all([
      saveExpense(expenseA),
      saveExpense(expenseB),
      saveIncome(incomeA),
      saveIncome(incomeB),
    ]);
    const expenses = (await getExpenses()).filter((item) => ['expense-a', 'expense-b'].includes(item.id));
    const incomes = (await getIncomes()).filter((item) => ['income-a', 'income-b'].includes(item.id));
    expect(totalExpenses(expenses)).toBe(160000);
    expect(totalIncome(incomes)).toBe(750050);
    expect(netCashFlow(totalIncome(incomes), totalExpenses(expenses))).toBe(590050);
  });

  it('يبقي السجلات بعد إغلاق اتصال قاعدة البيانات وإعادة فتحه', async () => {
    await closeDatabaseConnection();
    await initializeDatabase();
    expect((await getExpenses()).some((item) => item.id === expenseA.id)).toBe(true);
    expect((await getIncomes()).some((item) => item.id === incomeA.id)).toBe(true);
  });

  it('ينشئ نسخة بمعرّف جديد دون تعديل الأصل', async () => {
    const originalBefore = { ...(await getExpenses()).find((item) => item.id === expenseA.id)! };
    const duplicate = {
      ...originalBefore,
      id: 'expense-duplicate',
      date: '2026-08-20',
      createdAt: '2026-08-20T10:00:00.000Z',
    };
    await saveExpense(duplicate);
    const records = await getExpenses();
    expect(duplicate.id).not.toBe(originalBefore.id);
    expect(records.find((item) => item.id === originalBefore.id)).toEqual(originalBefore);
    expect(records.find((item) => item.id === duplicate.id)?.amountHalalas).toBe(originalBefore.amountHalalas);
  });

  it('ينسخ حركة دخل بمعرّف جديد دون تعديل الأصل', async () => {
    const originalBefore = { ...(await getIncomes()).find((item) => item.id === incomeA.id)! };
    const duplicate = {
      ...originalBefore,
      id: 'income-duplicate',
      date: '2026-08-21',
      createdAt: '2026-08-21T10:00:00.000Z',
    };
    await saveIncome(duplicate);
    const records = await getIncomes();
    expect(duplicate.id).not.toBe(originalBefore.id);
    expect(records.find((item) => item.id === originalBefore.id)).toEqual(originalBefore);
    expect(records.find((item) => item.id === duplicate.id)?.amountHalalas).toBe(originalBefore.amountHalalas);
  });

  it('يطبق البحث والفلاتر والإجمالي على النتائج الظاهرة فقط', async () => {
    const [categories, methods] = await Promise.all([getCategories(), getPaymentMethods()]);
    const records = (await getExpenses()).filter((item) =>
      ['expense-a', 'expense-b'].includes(item.id),
    );
    const workOnly = filterExpenses(
      records,
      {
        ...EMPTY_TRANSACTION_FILTERS,
        scope: 'work',
        fromDate: '2026-08-01',
        toDate: '2026-08-12',
        categoryId: 'work-materials',
        projectId: project.id,
        paymentMethodId: 'cash',
        query: 'مواد',
      },
      categories,
      methods,
      [project],
    );
    expect(workOnly.map((item) => item.id)).toEqual(['expense-a']);
    expect(totalExpenses(workOnly)).toBe(125075);

    const cleared = filterExpenses(
      records,
      EMPTY_TRANSACTION_FILTERS,
      categories,
      methods,
      [project],
    );
    expect(cleared).toHaveLength(2);
  });

  it('يطبق فلاتر الدخل والإجمالي على النتائج الظاهرة فقط', async () => {
    const [categories, methods] = await Promise.all([getCategories(), getPaymentMethods()]);
    const records = (await getIncomes()).filter((item) =>
      ['income-a', 'income-b'].includes(item.id),
    );
    const workOnly = filterIncomes(
      records,
      {
        ...EMPTY_TRANSACTION_FILTERS,
        scope: 'work',
        fromDate: '2026-08-01',
        toDate: '2026-08-12',
        categoryId: 'income-project-payment',
        projectId: project.id,
        paymentMethodId: 'bank-transfer',
        query: 'المشروع',
      },
      categories,
      methods,
      [project],
    );
    expect(workOnly.map((item) => item.id)).toEqual(['income-a']);
    expect(totalIncome(workOnly)).toBe(500000);
  });
});