import {
  DATABASE_VERSION,
  getAllData,
  replaceAllData,
  type FinanceData,
} from '@/db/database';
import {
  SCHEMA_VERSION,
  type Category,
  type Expense,
  type Income,
  type PaymentMethod,
  type Project,
  type Settings,
} from '@/types/finance';

export const BACKUP_VERSION = 1;
export const BACKUP_APP = 'masroufi';

export interface BackupFile {
  app: typeof BACKUP_APP;
  backupVersion: number;
  schemaVersion: number;
  databaseVersion: number;
  createdAt: string;
  data: FinanceData;
}

export interface BackupPreview {
  backup: BackupFile;
  expensesCount: number;
  incomesCount: number;
  projectsCount: number;
  categoriesCount: number;
  paymentMethodsCount: number;
}

export async function createBackup(): Promise<BackupFile> {
  const data = await getAllData();
  return {
    app: BACKUP_APP,
    backupVersion: BACKUP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    databaseVersion: DATABASE_VERSION,
    createdAt: new Date().toISOString(),
    data,
  };
}

export function validateBackupPayload(value: unknown): { valid: true; backup: BackupFile } | { valid: false; error: string } {
  if (!isRecord(value)) return { valid: false, error: 'ملف النسخة ليس JSON صالحًا.' };
  if (value.app !== BACKUP_APP) return { valid: false, error: 'هذه النسخة لا تخص تطبيق مصروفي.' };
  if (value.backupVersion !== BACKUP_VERSION) return { valid: false, error: 'إصدار النسخة الاحتياطية غير مدعوم.' };
  if (value.schemaVersion !== SCHEMA_VERSION) return { valid: false, error: 'إصدار مخطط البيانات غير مدعوم في هذه النسخة.' };
  if (value.databaseVersion !== DATABASE_VERSION) return { valid: false, error: 'إصدار قاعدة البيانات غير مدعوم في هذه النسخة.' };
  if (typeof value.createdAt !== 'string' || Number.isNaN(Date.parse(value.createdAt))) return { valid: false, error: 'تاريخ النسخة غير صالح.' };
  if (!isRecord(value.data)) return { valid: false, error: 'بيانات النسخة غير موجودة أو غير صالحة.' };

  const expenses = value.data.expenses;
  const incomes = value.data.incomes;
  const projects = value.data.projects;
  const categories = value.data.categories;
  const paymentMethods = value.data.paymentMethods;
  const settings = value.data.settings;
  if (!Array.isArray(expenses) || !Array.isArray(incomes) || !Array.isArray(projects) || !Array.isArray(categories) || !Array.isArray(paymentMethods) || !isRecord(settings)) {
    return { valid: false, error: 'توجد Stores مطلوبة مفقودة في النسخة.' };
  }
  if (!expenses.every(isExpense) || !incomes.every(isIncome) || !projects.every(isProject) || !categories.every(isCategory) || !paymentMethods.every(isPaymentMethod) || !isSettings(settings)) {
    return { valid: false, error: 'بنية أحد Stores أو قيمه غير صالحة.' };
  }
  const ids = {
    projects: new Set(projects.map((item) => item.id)),
    categories: new Set(categories.map((item) => item.id)),
    paymentMethods: new Set(paymentMethods.map((item) => item.id)),
  };
  if (hasDuplicateIds(projects) || hasDuplicateIds(categories) || hasDuplicateIds(paymentMethods) || hasDuplicateIds(expenses) || hasDuplicateIds(incomes)) {
    return { valid: false, error: 'توجد معرفات مكررة داخل النسخة.' };
  }
  const validRelations = [
    ...expenses.map((item) => [item.categoryId, item.projectId, item.paymentMethodId] as const),
    ...incomes.map((item) => [item.category, item.projectId, item.paymentMethodId] as const),
  ].every(([categoryId, projectId, paymentMethodId]) =>
    ids.categories.has(categoryId) &&
    (!projectId || ids.projects.has(projectId)) &&
    (!paymentMethodId || ids.paymentMethods.has(paymentMethodId)),
  );
  if (!validRelations) return { valid: false, error: 'توجد علاقة غير صالحة بين حركة وتصنيف أو مشروع أو طريقة دفع.' };
  return { valid: true, backup: value as unknown as BackupFile };
}

export function previewBackup(backup: BackupFile): BackupPreview {
  return {
    backup,
    expensesCount: backup.data.expenses.length,
    incomesCount: backup.data.incomes.length,
    projectsCount: backup.data.projects.length,
    categoriesCount: backup.data.categories.length,
    paymentMethodsCount: backup.data.paymentMethods.length,
  };
}

export function downloadBackup(backup: BackupFile): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `masroufi-backup-${backup.createdAt.slice(0, 10)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function restoreBackup(backup: BackupFile): Promise<void> {
  await replaceAllData(backup.data);
}

export async function readBackupFile(file: File): Promise<{ valid: true; preview: BackupPreview } | { valid: false; error: string }> {
  try {
    const parsed: unknown = JSON.parse(await file.text());
    const result = validateBackupPayload(parsed);
    return result.valid ? { valid: true, preview: previewBackup(result.backup) } : result;
  } catch {
    return { valid: false, error: 'تعذر قراءة الملف. اختر ملف JSON صالحًا.' };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isExpense(value: unknown): value is Expense {
  return isRecord(value) && isId(value.id) && isAmount(value.amountHalalas) && isDate(value.date) &&
    (value.scope === 'work' || value.scope === 'personal') && isId(value.categoryId) &&
    optionalString(value.projectId) && optionalString(value.paymentMethodId) && optionalString(value.description) &&
    optionalString(value.notes) && typeof value.createdAt === 'string';
}

function isIncome(value: unknown): value is Income {
  return isRecord(value) && isId(value.id) && isAmount(value.amountHalalas) && isDate(value.date) &&
    (value.scope === 'work' || value.scope === 'personal') && isId(value.category) &&
    optionalString(value.projectId) && optionalString(value.paymentMethodId) && optionalString(value.description) &&
    optionalString(value.notes) && typeof value.createdAt === 'string';
}

function isProject(value: unknown): value is Project {
  return isRecord(value) && isId(value.id) && typeof value.name === 'string' && isDate(value.startDate) &&
    (value.expectedEndDate === undefined || isDate(value.expectedEndDate)) &&
    (value.contractValueHalalas === undefined || isAmount(value.contractValueHalalas)) &&
    (value.budgetHalalas === undefined || isAmount(value.budgetHalalas)) &&
    (value.status === 'active' || value.status === 'paused' || value.status === 'completed' || value.status === 'archived') &&
    optionalString(value.client) && optionalString(value.location) && optionalString(value.notes) &&
    typeof value.createdAt === 'string' && typeof value.updatedAt === 'string';
}

function isCategory(value: unknown): value is Category {
  return isRecord(value) && isId(value.id) && typeof value.name === 'string' &&
    (value.scope === 'work' || value.scope === 'personal' || value.scope === 'both') &&
    (value.kind === 'expense' || value.kind === 'income') && typeof value.isVisible === 'boolean' && typeof value.isDefault === 'boolean';
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return isRecord(value) && isId(value.id) && typeof value.name === 'string' &&
    typeof value.isVisible === 'boolean' && typeof value.isDefault === 'boolean';
}

function isSettings(value: unknown): value is Settings {
  return isRecord(value) && value.id === 'app' && value.schemaVersion === SCHEMA_VERSION && value.currency === 'SAR' &&
    value.locale === 'ar-SA' && (value.theme === 'light' || value.theme === 'dark' || value.theme === 'system');
}

function hasDuplicateIds(records: Array<{ id: string }>): boolean {
  return new Set(records.map((record) => record.id)).size !== records.length;
}