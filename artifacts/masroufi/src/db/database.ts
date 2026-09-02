import {
  type Category,
  type CategoryKind,
  type Expense,
  type Income,
  type PaymentMethod,
  type Project,
  SCHEMA_VERSION,
  type Settings,
} from '@/types/finance';

const DATABASE_NAME = 'masroufi-local';
export const DATABASE_VERSION = 2;

const DEFAULT_CATEGORIES: Category[] = [
  ['work-materials', 'مواد', 'work'],
  ['work-labor', 'عمالة', 'work'],
  ['work-subcontractor', 'مقاول باطن', 'work'],
  ['work-equipment', 'معدات', 'work'],
  ['work-transport', 'نقل', 'work'],
  ['work-fuel', 'وقود', 'work'],
  ['work-car', 'سيارة', 'work'],
  ['work-housing', 'سكن', 'work'],
  ['work-travel', 'سفر', 'work'],
  ['work-fees', 'رسوم', 'work'],
  ['work-admin', 'مصاريف إدارية', 'work'],
  ['work-telecom', 'اتصالات', 'work'],
  ['work-other', 'أخرى', 'work'],
  ['personal-home', 'المنزل', 'personal'],
  ['personal-food', 'غذاء', 'personal'],
  ['personal-car', 'سيارة', 'personal'],
  ['personal-fuel', 'وقود', 'personal'],
  ['personal-health', 'صحة', 'personal'],
  ['personal-education', 'تعليم', 'personal'],
  ['personal-travel', 'سفر', 'personal'],
  ['personal-bills', 'فواتير', 'personal'],
  ['personal-telecom', 'اتصالات', 'personal'],
  ['personal-shopping', 'تسوق', 'personal'],
  ['personal-entertainment', 'ترفيه', 'personal'],
  ['personal-other', 'أخرى', 'personal'],
].map(([id, name, scope]) => ({
  id,
  name,
  scope: scope as Category['scope'],
  kind: 'expense' as CategoryKind,
  isVisible: true,
  isDefault: true,
}));

const DEFAULT_INCOME_CATEGORIES: Category[] = [
  ['income-project-payment', 'دفعة مشروع', 'work'],
  ['income-services', 'خدمات', 'work'],
  ['income-sales', 'مبيعات', 'work'],
  ['income-commission', 'عمولة', 'work'],
  ['income-refund-work', 'استرداد عمل', 'work'],
  ['income-other-work', 'دخل عمل آخر', 'work'],
  ['income-salary', 'راتب', 'personal'],
  ['income-bonus', 'مكافأة', 'personal'],
  ['income-transfer', 'تحويل', 'personal'],
  ['income-refund-personal', 'استرداد شخصي', 'personal'],
  ['income-extra', 'دخل إضافي', 'personal'],
  ['income-other-personal', 'دخل شخصي آخر', 'personal'],
].map(([id, name, scope]) => ({
  id,
  name,
  scope: scope as Category['scope'],
  kind: 'income' as CategoryKind,
  isVisible: true,
  isDefault: true,
}));

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  ['cash', 'نقدي'],
  ['card', 'بطاقة'],
  ['bank-transfer', 'تحويل بنكي'],
  ['bank-account', 'حساب بنكي'],
  ['other', 'أخرى'],
].map(([id, name]) => ({
  id,
  name,
  isVisible: true,
  isDefault: true,
}));

let databasePromise: Promise<IDBDatabase> | undefined;

function createStore(
  database: IDBDatabase,
  name: string,
  keyPath: string = 'id',
): void {
  if (!database.objectStoreNames.contains(name)) {
    database.createObjectStore(name, { keyPath });
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onerror = () => reject(request.error ?? new Error('تعذر فتح قاعدة البيانات المحلية'));
    request.onupgradeneeded = () => {
      const database = request.result;
      createStore(database, 'expenses');
      createStore(database, 'incomes');
      createStore(database, 'projects');
      createStore(database, 'categories');
      createStore(database, 'paymentMethods');
      createStore(database, 'settings');
    };
    request.onsuccess = () => resolve(request.result);
  });

  return databasePromise;
}

async function seedDefaults(database: IDBDatabase): Promise<void> {
  const transaction = database.transaction(
    ['categories', 'paymentMethods', 'settings'],
    'readwrite',
  );
  const categoriesStore = transaction.objectStore('categories');
  const paymentMethodsStore = transaction.objectStore('paymentMethods');
  const settingsStore = transaction.objectStore('settings');

  const categoriesRequest = categoriesStore.getAll() as IDBRequest<Category[]>;
  const paymentMethodsRequest =
    paymentMethodsStore.getAll() as IDBRequest<PaymentMethod[]>;
  const settingsRequest = settingsStore.get('app') as IDBRequest<
    Settings | undefined
  >;
  const [storedCategories, existingPaymentMethods, settings] =
    await Promise.all([
      requestToPromise(categoriesRequest),
      requestToPromise(paymentMethodsRequest),
      requestToPromise(settingsRequest),
    ]);
  const existingCategories = storedCategories.map((category) => ({
    ...category,
    kind: category.kind ?? 'expense',
  }));

  if (existingCategories.length === 0) {
    DEFAULT_CATEGORIES.forEach((category) => categoriesStore.put(category));
  } else {
    existingCategories.forEach((category) => categoriesStore.put(category));
  }
  if (!existingCategories.some((category) => category.kind === 'income')) {
    DEFAULT_INCOME_CATEGORIES.forEach((category) => categoriesStore.put(category));
  }
  if (existingPaymentMethods.length === 0) {
    DEFAULT_PAYMENT_METHODS.forEach((method) => paymentMethodsStore.put(method));
  }
  if (!settings) {
    settingsStore.put({
      id: 'app',
      schemaVersion: SCHEMA_VERSION,
      currency: 'SAR',
      locale: 'ar-SA',
      theme: 'system',
    } satisfies Settings);
  } else if (settings.schemaVersion !== SCHEMA_VERSION) {
    settingsStore.put({ ...settings, schemaVersion: SCHEMA_VERSION });
  }

  await transactionToPromise(transaction);
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('تعذر قراءة البيانات المحلية'));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('تعذر حفظ البيانات المحلية'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('تم إلغاء حفظ البيانات المحلية'));
  });
}

export async function initializeDatabase(): Promise<void> {
  const database = await openDatabase();
  await seedDefaults(database);
}

export interface FinanceData {
  expenses: Expense[];
  incomes: Income[];
  projects: Project[];
  categories: Category[];
  paymentMethods: PaymentMethod[];
  settings: Settings;
}

export async function getAllData(): Promise<FinanceData> {
  const database = await openDatabase();
  const transaction = database.transaction(
    ['expenses', 'incomes', 'projects', 'categories', 'paymentMethods', 'settings'],
    'readonly',
  );
  const [expenses, incomes, projects, categories, paymentMethods, settings] =
    await Promise.all([
      requestToPromise(transaction.objectStore('expenses').getAll() as IDBRequest<Expense[]>),
      requestToPromise(transaction.objectStore('incomes').getAll() as IDBRequest<Income[]>),
      requestToPromise(transaction.objectStore('projects').getAll() as IDBRequest<Project[]>),
      requestToPromise(transaction.objectStore('categories').getAll() as IDBRequest<Category[]>),
      requestToPromise(transaction.objectStore('paymentMethods').getAll() as IDBRequest<PaymentMethod[]>),
      requestToPromise(transaction.objectStore('settings').get('app') as IDBRequest<Settings | undefined>),
    ]);
  if (!settings) throw new Error('إعدادات التطبيق المحلية غير موجودة');
  return {
    expenses,
    incomes,
    projects: projects.map((project) => ({ ...project, updatedAt: project.updatedAt ?? project.createdAt })),
    categories: categories.map((category) => ({ ...category, kind: category.kind ?? 'expense' })),
    paymentMethods,
    settings,
  };
}

export async function replaceAllData(data: FinanceData): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    ['expenses', 'incomes', 'projects', 'categories', 'paymentMethods', 'settings'],
    'readwrite',
  );
  const stores = {
    expenses: transaction.objectStore('expenses'),
    incomes: transaction.objectStore('incomes'),
    projects: transaction.objectStore('projects'),
    categories: transaction.objectStore('categories'),
    paymentMethods: transaction.objectStore('paymentMethods'),
    settings: transaction.objectStore('settings'),
  };
  try {
    Object.values(stores).forEach((store) => store.clear());
    data.expenses.forEach((record) => stores.expenses.put(record));
    data.incomes.forEach((record) => stores.incomes.put(record));
    data.projects.forEach((record) => stores.projects.put(record));
    data.categories.forEach((record) => stores.categories.put(record));
    data.paymentMethods.forEach((record) => stores.paymentMethods.put(record));
    stores.settings.put(data.settings);
  } catch (error) {
    transaction.abort();
    try {
      await transactionToPromise(transaction);
    } catch {
      // The expected abort is converted back to the original write error below.
    }
    throw error;
  }
  await transactionToPromise(transaction);
}

export async function resetToCleanState(): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    ['expenses', 'incomes', 'projects', 'categories', 'paymentMethods', 'settings'],
    'readwrite',
  );
  const stores = {
    expenses: transaction.objectStore('expenses'),
    incomes: transaction.objectStore('incomes'),
    projects: transaction.objectStore('projects'),
    categories: transaction.objectStore('categories'),
    paymentMethods: transaction.objectStore('paymentMethods'),
    settings: transaction.objectStore('settings'),
  };
  Object.values(stores).forEach((store) => store.clear());
  DEFAULT_CATEGORIES.forEach((record) => stores.categories.put(record));
  DEFAULT_INCOME_CATEGORIES.forEach((record) => stores.categories.put(record));
  DEFAULT_PAYMENT_METHODS.forEach((record) => stores.paymentMethods.put(record));
  stores.settings.put({
    id: 'app',
    schemaVersion: SCHEMA_VERSION,
    currency: 'SAR',
    locale: 'ar-SA',
    theme: 'system',
  } satisfies Settings);
  await transactionToPromise(transaction);
}

export function getDatabase(): Promise<IDBDatabase> {
  return openDatabase();
}

async function getAllRecords<T>(
  storeName: 'categories' | 'paymentMethods',
): Promise<T[]> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readonly');
  return requestToPromise(
    transaction.objectStore(storeName).getAll() as IDBRequest<T[]>,
  );
}

async function putRecord<T extends { id: string }>(
  storeName: 'categories' | 'paymentMethods',
  record: T,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).put(record);
  await transactionToPromise(transaction);
}

export function getCategories(): Promise<Category[]> {
  return getAllRecords<Category>('categories').then((categories) =>
    categories.map((category) => ({
      ...category,
      kind: category.kind ?? 'expense',
    })),
  );
}

export function saveCategory(category: Category): Promise<void> {
  return putRecord('categories', category);
}

export function getPaymentMethods(): Promise<PaymentMethod[]> {
  return getAllRecords<PaymentMethod>('paymentMethods');
}

export function savePaymentMethod(method: PaymentMethod): Promise<void> {
  return putRecord('paymentMethods', method);
}

export function getExpenses(): Promise<Expense[]> {
  return getAllRecordsFromStore<Expense>('expenses');
}

export function saveExpense(expense: Expense): Promise<void> {
  return putRecordInStore('expenses', expense);
}

export function deleteExpense(id: string): Promise<void> {
  return deleteRecordFromStore('expenses', id);
}

export function getIncomes(): Promise<Income[]> {
  return getAllRecordsFromStore<Income>('incomes');
}

export function saveIncome(income: Income): Promise<void> {
  return putRecordInStore('incomes', income);
}

export function deleteIncome(id: string): Promise<void> {
  return deleteRecordFromStore('incomes', id);
}

export function getProjects(): Promise<Project[]> {
  return getAllRecordsFromStore<Project>('projects').then((projects) =>
    projects.map((project) => ({
      ...project,
      updatedAt: project.updatedAt ?? project.createdAt,
    })),
  );
}

export function saveProject(project: Project): Promise<void> {
  return putRecordInStore('projects', project);
}

export function deleteProject(id: string): Promise<void> {
  return deleteRecordFromStore('projects', id);
}

export async function closeDatabaseConnection(): Promise<void> {
  if (!databasePromise) return;
  const database = await databasePromise;
  database.close();
  databasePromise = undefined;
}

async function getAllRecordsFromStore<T>(
  storeName: 'expenses' | 'incomes' | 'projects',
): Promise<T[]> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readonly');
  return requestToPromise(
    transaction.objectStore(storeName).getAll() as IDBRequest<T[]>,
  );
}

async function putRecordInStore<T extends { id: string }>(
  storeName: 'expenses' | 'incomes' | 'projects',
  record: T,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).put(record);
  await transactionToPromise(transaction);
}

async function deleteRecordFromStore(
  storeName: 'expenses' | 'incomes' | 'projects',
  id: string,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).delete(id);
  await transactionToPromise(transaction);
}

export type FinanceStore = Expense | Income | Project | Category | PaymentMethod | Settings;