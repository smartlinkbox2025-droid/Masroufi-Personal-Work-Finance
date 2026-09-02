export const SCHEMA_VERSION = 2;

export type FinanceScope = 'work' | 'personal';
export type CategoryScope = FinanceScope | 'both';
export type CategoryKind = 'expense' | 'income';
export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface Expense {
  id: string;
  amountHalalas: number;
  date: string;
  scope: FinanceScope;
  categoryId: string;
  projectId?: string;
  paymentMethodId?: string;
  description?: string;
  notes?: string;
  createdAt: string;
}

export interface Income {
  id: string;
  amountHalalas: number;
  date: string;
  scope: FinanceScope;
  category: string;
  projectId?: string;
  paymentMethodId?: string;
  description?: string;
  notes?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  client?: string;
  location?: string;
  startDate: string;
  expectedEndDate?: string;
  contractValueHalalas?: number;
  budgetHalalas?: number;
  status: ProjectStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  scope: CategoryScope;
  kind: CategoryKind;
  isVisible: boolean;
  isDefault: boolean;
}

export interface PaymentMethod {
  id: string;
  name: string;
  isVisible: boolean;
  isDefault: boolean;
}

export interface Settings {
  id: 'app';
  schemaVersion: number;
  currency: 'SAR';
  locale: 'ar-SA';
  theme: 'light' | 'dark' | 'system';
}